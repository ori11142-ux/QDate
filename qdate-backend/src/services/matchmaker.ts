import { Types } from 'mongoose';
import { UserDoc, UserModel } from '../models/User';
import { MatchDoc, MatchModel } from '../models/Match';

type Phase = 'phase_1' | 'phase_2';

const LEARNING_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Heuristic compatibility score between a requester and a candidate (0–100).
 * This is the placeholder the ML ranker will eventually replace — same inputs,
 * same output range, so the endpoint contract doesn't change when ML lands.
 */
export function scoreCandidate(requester: UserDoc, candidate: UserDoc): number {
  const rp = requester.profile;
  const cp = candidate.profile;
  if (!rp || !cp) return 0;

  let score = 0;

  // Shared intent is the strongest signal — both want the same kind of thing.
  if (rp.intent === cp.intent) {
    score += 40;
  }

  // Shared communication style.
  if (rp.commStyle === cp.commStyle) {
    score += 25;
  }

  // Age proximity: full marks if same age, decaying ~2 pts per year apart.
  const ageDiff = Math.abs(requester.age - candidate.age);
  score += Math.max(0, 20 - ageDiff * 2);

  // Similar weighting of shared intellect (both value it similarly).
  const intellectDiff = Math.abs(
    rp.sharedIntellectImportance - cp.sharedIntellectImportance
  );
  score += Math.max(0, 15 - intellectDiff * 3);

  return score;
}

/**
 * Turn a User's stated profile into a short, readable bio line for the match card.
 * (Users don't write free-text bios yet, so we synthesize one from their intent.)
 */
export function synthesizeBio(user: UserDoc): string {
  const p = user.profile;
  if (!p) return 'On QDate';
  const intentPhrase: Record<string, string> = {
    long_term: 'Looking for something long-term',
    casual: 'Here for casual dating',
    explore: 'Exploring and seeing what happens',
    friendship: 'Looking to make a real connection',
  };
  const commPhrase: Record<string, string> = {
    texting_first: 'texts first',
    voice_early: 'likes calls early on',
    meet_in_person: 'prefers meeting in person',
  };
  const intent = intentPhrase[p.intent] ?? 'On QDate';
  const comm = commPhrase[p.commStyle] ?? '';
  return comm ? `${intent} · ${comm}` : intent;
}

/** Day number within the 14-day learning period, derived from registration date. */
function learningDay(user: UserDoc): number {
  const created = (user as any).createdAt as Date | undefined;
  if (!created) return 1;
  const days = Math.floor((Date.now() - created.getTime()) / DAY_MS) + 1;
  return Math.min(LEARNING_DAYS, Math.max(1, days));
}

/**
 * Find the best available candidate for a requester.
 * Excludes the requester and anyone they've already been matched with (any status),
 * so each new match introduces someone new.
 */
/** Does someone with this `attraction` want to be matched with this `gender`? */
function attractedTo(attraction: string | null | undefined, gender: string | null | undefined): boolean {
  if (!attraction) return true; // no preference recorded → don't filter them out
  if (attraction === 'both') return true;
  if (attraction === 'men') return gender === 'man';
  if (attraction === 'women') return gender === 'woman';
  return true;
}

/**
 * Two people are gender-compatible when each is attracted to the other's gender.
 * If either side hasn't recorded gender/attraction (older accounts), we don't
 * filter them out — leniency keeps pre-existing data working.
 */
function genderCompatible(a: UserDoc, b: UserDoc): boolean {
  const aWantsB = attractedTo(a.attraction, b.gender);
  const bWantsA = attractedTo(b.attraction, a.gender);
  return aWantsB && bWantsA;
}

export async function findBestCandidate(requester: UserDoc): Promise<UserDoc | null> {
  const excludedIds: Types.ObjectId[] = [requester._id as Types.ObjectId];

  // Everyone currently busy in a pairing (one-at-a-time applies to candidates
  // too). We deliberately do NOT exclude people whose past pairing with the
  // requester already ended — that lets a small user base re-match after a skip.
  const busy = await MatchModel.find({
    status: { $in: ['pending_reveal', 'active', 'connected'] },
  }).select('userId');
  for (const m of busy) {
    excludedIds.push(m.userId as Types.ObjectId);
  }

  const candidates = await UserModel.find({ _id: { $nin: excludedIds } });

  // Keep only candidates who are a mutual gender/attraction match.
  const eligible = candidates.filter((c) => genderCompatible(requester, c));
  if (eligible.length === 0) return null;

  let best: UserDoc | null = null;
  let bestScore = -1;
  for (const c of eligible) {
    const s = scoreCandidate(requester, c);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return best;
}

export type GeneratedMatch = {
  match: MatchDoc;
  candidate: UserDoc;
  isExisting: boolean;
};

/**
 * Get the requester's current open match, or generate a new one if they have none.
 * Enforces the "one match at a time" rule: if a pending_reveal/active match exists
 * (and hasn't expired), it is returned instead of creating another.
 */
export async function generateMatchForUser(
  userId: string,
  phase: Phase
): Promise<GeneratedMatch | null> {
  const requester = await UserModel.findById(userId);
  if (!requester) {
    throw new Error('User not found');
  }

  // One-at-a-time: return the existing open match if there is one.
  const existing = await MatchModel.findOne({
    userId: requester._id,
    status: { $in: ['pending_reveal', 'active', 'connected'] },
  }).sort({ createdAt: -1 });

  if (existing && existing.expiresAt.getTime() > Date.now()) {
    const candidate = await UserModel.findById(existing.candidateUserId);
    if (candidate) {
      return { match: existing, candidate, isExisting: true };
    }
    // Candidate vanished (deleted) — fall through and make a new match.
  }

  const candidate = await findBestCandidate(requester);
  if (!candidate) return null;

  const isPhase2 = phase === 'phase_2';
  const expiresAt = new Date(Date.now() + (isPhase2 ? 7 * DAY_MS : DAY_MS));

  // Shared conversation key for both sides of the mutual pairing.
  const conversationId = new Types.ObjectId().toString();
  const day = isPhase2 ? null : learningDay(requester);

  // Requester's side (the one we return).
  const match = await MatchModel.create({
    userId: requester._id,
    candidateUserId: candidate._id,
    phase,
    status: 'pending_reveal',
    expiresAt,
    conversationId,
    dayInLearningPeriod: day,
    isIntentionalPairing: isPhase2,
  });

  // Reciprocal side — the candidate now has this as their current match too,
  // so they see the requester on their own Today screen and share the chat.
  await MatchModel.create({
    userId: candidate._id,
    candidateUserId: requester._id,
    phase,
    status: 'pending_reveal',
    expiresAt,
    conversationId,
    dayInLearningPeriod: isPhase2 ? null : learningDay(candidate),
    isIntentionalPairing: isPhase2,
  });

  return { match, candidate, isExisting: false };
}

/**
 * Map a match + its candidate into the shape the mobile app's `Match` type expects.
 */
export function toClientMatch(match: MatchDoc, candidate: UserDoc) {
  return {
    matchId: String(match._id),
    status: match.status,
    conversationId: match.conversationId ?? undefined,
    candidateName: candidate.name,
    candidateAge: candidate.age,
    candidateBio: synthesizeBio(candidate),
    candidatePhotoUrl: candidate.photoUrl ?? undefined,
    expiresAt: match.expiresAt.toISOString(),
    dayInLearningPeriod: match.dayInLearningPeriod ?? undefined,
    totalLearningDays: match.phase === 'phase_1' ? LEARNING_DAYS : undefined,
    isIntentionalPairing: match.isIntentionalPairing ?? undefined,
    cooldownActive: false,
  };
}
