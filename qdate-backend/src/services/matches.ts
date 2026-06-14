import { Types } from 'mongoose';
import { MatchDoc, MatchModel } from '../models/Match';

export type CreateMatchInput = {
  userId: string | Types.ObjectId;
  candidateUserId: string | Types.ObjectId;
  phase: 'phase_1' | 'phase_2';
  expiresAt: Date;
  dayInLearningPeriod?: number;
  isIntentionalPairing?: boolean;
};

export async function createMatch(input: CreateMatchInput): Promise<MatchDoc> {
  return MatchModel.create(input);
}

export async function findMatchById(
  id: string | Types.ObjectId
): Promise<MatchDoc | null> {
  return MatchModel.findById(id);
}

/**
 * Returns the user's currently-active or pending-reveal match, if any.
 * Phase 1 users have at most one of these at a time.
 */
export async function getCurrentMatchForUser(
  userId: string | Types.ObjectId
): Promise<MatchDoc | null> {
  return MatchModel.findOne({
    userId,
    status: { $in: ['pending_reveal', 'active'] },
  }).sort({ createdAt: -1 });
}

export async function markRevealed(
  matchId: string | Types.ObjectId
): Promise<MatchDoc | null> {
  return MatchModel.findByIdAndUpdate(
    matchId,
    { status: 'active', revealedAt: new Date() },
    { new: true }
  );
}

export async function markSkipped(
  matchId: string | Types.ObjectId
): Promise<MatchDoc | null> {
  return MatchModel.findByIdAndUpdate(
    matchId,
    { status: 'skipped' },
    { new: true }
  );
}

export async function markConnected(
  matchId: string | Types.ObjectId
): Promise<MatchDoc | null> {
  return MatchModel.findByIdAndUpdate(
    matchId,
    { status: 'connected' },
    { new: true }
  );
}

/**
 * Sweep job — call from a cron worker that runs every few minutes.
 * Moves any matches whose expiresAt has passed into 'expired' status.
 */
export async function expireStaleMatches(): Promise<number> {
  const result = await MatchModel.updateMany(
    {
      status: { $in: ['pending_reveal', 'active'] },
      expiresAt: { $lt: new Date() },
    },
    { status: 'expired' }
  );
  return result.modifiedCount;
}

export async function listMatchesForUser(
  userId: string | Types.ObjectId,
  limit = 20
): Promise<MatchDoc[]> {
  return MatchModel.find({ userId }).sort({ createdAt: -1 }).limit(limit);
}

/**
 * End BOTH sides of a mutual pairing (skip). Sets every match sharing the
 * given conversationId to 'skipped', so neither person stays paired.
 */
export async function skipPairing(conversationId: string): Promise<number> {
  const result = await MatchModel.updateMany(
    { conversationId, status: { $in: ['pending_reveal', 'active', 'connected'] } },
    { status: 'skipped' }
  );
  return result.modifiedCount;
}

/**
 * How many sides of a mutual pairing have tapped "Open Chat" (status connected).
 * bothConnected is true only when BOTH people have opened the chat.
 */
export async function getPairingConnectState(conversationId: string): Promise<{
  total: number;
  connected: number;
  bothConnected: boolean;
}> {
  const total = await MatchModel.countDocuments({ conversationId });
  const connected = await MatchModel.countDocuments({
    conversationId,
    status: 'connected',
  });
  return { total, connected, bothConnected: connected >= 2 };
}
