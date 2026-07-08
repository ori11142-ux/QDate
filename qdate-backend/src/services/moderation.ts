import { Types } from 'mongoose';

import { UserDoc, UserModel } from '../models/User';
import { MatchModel } from '../models/Match';
import { ReportDoc, ReportModel } from '../models/Report';
import {
  GUIDELINES_VERSION,
  SEVERITY_WEIGHT,
  Severity,
  evaluateReportCategory,
} from '../data/guidelines';

const DAY_MS = 24 * 60 * 60 * 1000;

export class ModerationError extends Error {
  constructor(
    public code:
      | 'USER_NOT_FOUND'
      | 'REPORTED_USER_NOT_FOUND'
      | 'SELF_REPORT'
      | 'INVALID_CATEGORY'
      | 'INVALID_TARGET',
    message: string
  ) {
    super(message);
  }
}

/**
 * Record that a user has read and agreed to ("signed") the community
 * guidelines at the given version.
 */
export async function acceptGuidelines(
  userId: string | Types.ObjectId,
  version: string = GUIDELINES_VERSION
): Promise<UserDoc | null> {
  return UserModel.findByIdAndUpdate(
    userId,
    { guidelinesAcceptedVersion: version, guidelinesAcceptedAt: new Date() },
    { new: true }
  );
}

export interface ModerationStanding {
  moderationStatus: 'active' | 'warned' | 'suspended' | 'banned';
  strikeCount: number;
  suspendedUntil: Date | null;
}

/**
 * Is this account currently blocked from using the app? Suspensions auto-lift
 * once `suspendedUntil` passes; bans are permanent.
 */
export function isBlocked(user: UserDoc): { blocked: boolean; reason?: string } {
  const status = user.get('moderationStatus') as string;
  if (status === 'banned') {
    return { blocked: true, reason: 'This account has been banned for violating the community guidelines.' };
  }
  if (status === 'suspended') {
    const until = user.get('suspendedUntil') as Date | null;
    if (until && until.getTime() > Date.now()) {
      const days = Math.ceil((until.getTime() - Date.now()) / DAY_MS);
      return {
        blocked: true,
        reason: `This account is suspended for violating the community guidelines. Try again in ${days} day${days === 1 ? '' : 's'}.`,
      };
    }
  }
  return { blocked: false };
}

/**
 * Recompute a reported user's standing from the full history of rule-violating
 * reports against them. The score is weighted by severity and de-duplicated per
 * reporter (each distinct reporter contributes only their most-severe report),
 * so one person cannot inflate someone's strikes by reporting repeatedly.
 */
export async function recomputeStanding(
  reportedUserId: string | Types.ObjectId
): Promise<ModerationStanding> {
  const violating = await ReportModel.find({
    reportedUserId,
    violatesRules: true,
  }).select('reporterId severity');

  const perReporter = new Map<string, number>();
  let hasCritical = false;
  for (const r of violating) {
    const severity = r.severity as Severity;
    if (severity === 'critical') hasCritical = true;
    const weight = SEVERITY_WEIGHT[severity] ?? 0;
    const key = String(r.reporterId);
    perReporter.set(key, Math.max(perReporter.get(key) ?? 0, weight));
  }

  let score = 0;
  for (const weight of perReporter.values()) score += weight;

  let moderationStatus: ModerationStanding['moderationStatus'] = 'active';
  let suspendedUntil: Date | null = null;

  if (score >= 8) {
    moderationStatus = 'banned';
  } else if (hasCritical) {
    // A critical report (threats, underage) suspends immediately, pending review.
    moderationStatus = 'suspended';
    suspendedUntil = new Date(Date.now() + 30 * DAY_MS);
  } else if (score >= 5) {
    moderationStatus = 'suspended';
    suspendedUntil = new Date(Date.now() + 7 * DAY_MS);
  } else if (score >= 3) {
    moderationStatus = 'warned';
  }

  await UserModel.updateOne(
    { _id: reportedUserId },
    { moderationStatus, strikeCount: score, suspendedUntil }
  );

  return { moderationStatus, strikeCount: score, suspendedUntil };
}

export interface SubmitReportInput {
  reporterId: string;
  reportedUserId?: string;
  matchId?: string;
  conversationId?: string;
  category: string;
  reason?: string;
}

/**
 * Work out who is being reported. Preferring the match/conversation the report
 * was filed from means the client can't simply hand us an arbitrary victim id —
 * we derive the other participant from the pairing the reporter is actually in.
 */
async function resolveReportedUserId(
  reporterId: Types.ObjectId,
  input: SubmitReportInput
): Promise<Types.ObjectId | null> {
  if (input.matchId && Types.ObjectId.isValid(input.matchId)) {
    const match = await MatchModel.findById(input.matchId).select('userId candidateUserId');
    if (match) {
      const owner = match.userId as Types.ObjectId;
      const candidate = match.candidateUserId as Types.ObjectId;
      return owner.equals(reporterId) ? candidate : owner;
    }
  }

  if (input.conversationId) {
    // The other participant's own match doc carries their id in `userId`.
    const other = await MatchModel.findOne({
      conversationId: input.conversationId,
      userId: { $ne: reporterId },
    }).select('userId');
    if (other) return other.userId as Types.ObjectId;
  }

  if (input.reportedUserId && Types.ObjectId.isValid(input.reportedUserId)) {
    return new Types.ObjectId(input.reportedUserId);
  }

  return null;
}

export interface SubmitReportResult {
  report: ReportDoc;
  duplicate: boolean;
  standing: ModerationStanding;
}

/**
 * File a report, run the automated rule check, and re-evaluate the reported
 * user's standing. Idempotent per (reporter, reported) pair while a prior report
 * is still open — reporting the same person again returns the existing report
 * instead of stacking strikes.
 */
export async function submitReport(input: SubmitReportInput): Promise<SubmitReportResult> {
  if (!Types.ObjectId.isValid(input.reporterId)) {
    throw new ModerationError('USER_NOT_FOUND', 'Invalid reporter id');
  }
  const reporterId = new Types.ObjectId(input.reporterId);

  const evaluation = evaluateReportCategory(input.category);
  if (!evaluation) {
    throw new ModerationError('INVALID_CATEGORY', 'Unknown report category');
  }

  const reporter = await UserModel.findById(reporterId).select('_id');
  if (!reporter) {
    throw new ModerationError('USER_NOT_FOUND', 'Reporter not found');
  }

  const reportedUserId = await resolveReportedUserId(reporterId, input);
  if (!reportedUserId) {
    throw new ModerationError('INVALID_TARGET', 'Could not determine who is being reported');
  }
  if (reportedUserId.equals(reporterId)) {
    throw new ModerationError('SELF_REPORT', 'You cannot report yourself');
  }

  const reported = await UserModel.findById(reportedUserId).select('_id');
  if (!reported) {
    throw new ModerationError('REPORTED_USER_NOT_FOUND', 'Reported user not found');
  }

  // Dedupe: one open report per (reporter, reported) pair.
  const existing = await ReportModel.findOne({
    reporterId,
    reportedUserId,
    status: { $in: ['pending', 'auto_flagged'] },
  });
  if (existing) {
    const standing = await recomputeStanding(reportedUserId);
    return { report: existing, duplicate: true, standing };
  }

  const report = await ReportModel.create({
    reporterId,
    reportedUserId,
    conversationId: input.conversationId ?? null,
    matchId:
      input.matchId && Types.ObjectId.isValid(input.matchId)
        ? new Types.ObjectId(input.matchId)
        : null,
    category: evaluation.category.id,
    reason: (input.reason ?? '').slice(0, 1000),
    violatesRules: evaluation.violatesRules,
    ruleIds: evaluation.ruleIds,
    severity: evaluation.severity,
    status: evaluation.violatesRules ? 'auto_flagged' : 'pending',
  });

  const standing = await recomputeStanding(reportedUserId);
  return { report, duplicate: false, standing };
}

/** Current standing for a user (used by an admin/debug endpoint). */
export async function getModerationStanding(
  userId: string
): Promise<ModerationStanding | null> {
  if (!Types.ObjectId.isValid(userId)) return null;
  const user = await UserModel.findById(userId).select(
    'moderationStatus strikeCount suspendedUntil'
  );
  if (!user) return null;
  return {
    moderationStatus: user.get('moderationStatus'),
    strikeCount: user.get('strikeCount'),
    suspendedUntil: (user.get('suspendedUntil') as Date | null) ?? null,
  };
}
