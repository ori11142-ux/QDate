// Matchmaker: the core engine that picks each user's match. It scores candidates
// with the ML ranker, applies gender/age/reciprocity rules, enforces the
// "one match at a time" + phase/cooldown cadence, and creates both sides of a pairing.
import { Types } from 'mongoose';
import { UserDoc, UserModel } from '../models/User';
import { MatchDoc, MatchModel } from '../models/Match';
import { scoreCandidateHeuristicML, scoreFromFeatures, learnWeightsFromOutcomes } from '../ml/ranker';
import { extractUserFeatures, UserFeatureVector } from '../ml/features';
import { getGlobalUsableTasteUsers } from '../ml/faceTaste';
import { notBlockedQuery } from './moderation';

type Phase = 'phase_1' | 'phase_2';

const LEARNING_DAYS = 14;
const PHASE2_CADENCE_DAYS = 7;
const PHASE2_QUALITY_THRESHOLD = 72;
const DAY_MS = 24 * 60 * 60 * 1000;

// A candidate "accepts" the requester when the requester scores at least this
// fraction of that candidate's OWN best available option — so we don't pair
// someone with a partner they'd clearly rather trade away. Reciprocity nudges
// selection toward two-sided matches; it never blocks a match outright.
const RECIPROCITY_FACTOR = 0.85;

/**
 * Heuristic compatibility score between a requester and a candidate (0–100).
 * This is the placeholder the ML ranker will eventually replace — same inputs,
 * same output range, so the endpoint contract doesn't change when ML lands.
 */
export function scoreCandidate(requester: UserDoc, candidate: UserDoc): number {
  return scoreCandidateHeuristicML(requester, candidate);
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
  if (!attraction || attraction === 'both') return true; // no preference → don't filter
  if (!gender) return true; // the other side's gender isn't recorded → stay lenient
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

/** Each person must fall inside the OTHER's preferred age range (mutual). */
export function ageCompatible(a: UserDoc, b: UserDoc): boolean {
  const ap = (a.get('agePreference') as { min?: number; max?: number } | undefined) ?? {};
  const bp = (b.get('agePreference') as { min?: number; max?: number } | undefined) ?? {};
  const aMin = ap.min ?? 18;
  const aMax = ap.max ?? 99;
  const bMin = bp.min ?? 18;
  const bMax = bp.max ?? 99;
  return b.age >= aMin && b.age <= aMax && a.age >= bMin && a.age <= bMax;
}

/**
 * Pure reciprocity policy. Walk a requester's ranked shortlist and return the
 * FIRST candidate for whom the requester is also a near-top option — the
 * requester's score with them must be at least `factor` of that candidate's own
 * best alternative. Falls back to the top-ranked item so a match is always
 * produced when the shortlist is non-empty. Exported for unit tests.
 */
export function selectReciprocalMatch<T>(
  ranked: { item: T; score: number }[],
  bestAlternativeScore: (item: T) => number,
  factor: number
): T | null {
  for (const entry of ranked) {
    const theirBest = Math.max(entry.score, bestAlternativeScore(entry.item));
    if (entry.score >= factor * theirBest) return entry.item;
  }
  return ranked.length > 0 ? ranked[0].item : null;
}

// The heart of matching: exclude self/busy/already-matched people, keep only
// gender+age-eligible ones, score the whole pool, then apply the reciprocity gate.
async function findBestCandidateWithScore(
  requester: UserDoc,
  phase?: Phase
): Promise<{ candidate: UserDoc; score: number } | null> {
  const excludedIds: Types.ObjectId[] = [requester._id as Types.ObjectId];

  // Everyone currently busy in a LIVE pairing (one-at-a-time applies to candidates
  // too). A pending/active match only counts while it hasn't expired — otherwise a
  // pair who never revealed would stay "busy" forever and silently vanish from
  // everyone's pool. A `connected` match (open chat) keeps them busy regardless of
  // expiresAt. (The expireStaleMatches sweep marks the stale ones; this also covers
  // the window before the next sweep runs.)
  const busy = await MatchModel.find({
    $or: [
      { status: 'connected' },
      { status: { $in: ['pending_reveal', 'active'] }, expiresAt: { $gt: new Date() } },
    ],
  }).select('userId');
  for (const m of busy) {
    excludedIds.push(m.userId as Types.ObjectId);
  }

  // Anyone the requester has ALREADY been matched with (any status). Once a
  // match is skipped it should be gone for good — never reintroduce the same
  // person, even when the user base is small.
  const pastMatches = await MatchModel.find({ userId: requester._id }).select('candidateUserId');
  for (const m of pastMatches) {
    excludedIds.push(m.candidateUserId as Types.ObjectId);
  }

  // Load the select:false face fields so the ranker's Phase-2 taste blend has
  // them without any per-candidate query.
  // Exclude requester + already-matched + busy, and NEVER surface banned or
  // actively-suspended accounts.
  const candidates = await UserModel.find({ _id: { $nin: excludedIds }, ...notBlockedQuery() }).select(
    '+faceEmbedding +faceTasteVector +faceTasteMargin +faceTasteLikes +faceTasteDislikes'
  );

  // Keep only candidates who are a mutual gender/attraction AND age-range match.
  // In Phase 2 (a high-investment 7-day curated pairing) also exclude anyone still
  // in their Phase-1 learning period — pairing them here would strand them on the
  // 7-day cadence/cooldown instead of daily matches.
  const eligible = candidates.filter(
    (c) =>
      genderCompatible(requester, c) &&
      ageCompatible(requester, c) &&
      (phase !== 'phase_2' || learningDay(c) >= LEARNING_DAYS)
  );
  if (eligible.length === 0) return null;

  // Score everything from features extracted ONCE per user (requester + the whole
  // available pool) plus the learned weights. scoreFromFeatures is pure, so the
  // reciprocity check below — which needs each candidate's OWN best alternative —
  // adds no extra DB work. (At scale these features would be cached/batched.)
  const [requesterFeatures, weights, globalTaste] = await Promise.all([
    extractUserFeatures(requester),
    learnWeightsFromOutcomes(),
    getGlobalUsableTasteUsers(),
  ]);
  const featById = new Map<string, UserFeatureVector>();
  await Promise.all(
    candidates.map(async (c) => {
      featById.set(String(c._id), await extractUserFeatures(c));
    })
  );
  const scoreOf = (a: UserFeatureVector, b: UserFeatureVector) =>
    scoreFromFeatures(a, b, weights, globalTaste);

  // The requester's own shortlist, best match first.
  const ranked = eligible
    .map((c) => {
      const feat = featById.get(String(c._id))!;
      return { candidate: c, feat, score: scoreOf(requesterFeatures, feat) };
    })
    .sort((a, b) => b.score - a.score);

  // Reciprocity gate (pure policy in selectReciprocalMatch): prefer the
  // highest-ranked candidate for whom the requester is ALSO a near-top option —
  // that candidate wouldn't clearly rather be matched with someone else in the
  // pool. Their alternatives are approximated by the same available pool, so this
  // is a preference heuristic, not exact stable matching.
  type Ranked = (typeof ranked)[number];
  const bestAlternativeScore = (entry: Ranked): number => {
    let best = 0;
    for (const other of candidates) {
      if (String(other._id) === String(entry.candidate._id)) continue;
      if (!genderCompatible(entry.candidate, other) || !ageCompatible(entry.candidate, other)) {
        continue;
      }
      const s = scoreOf(entry.feat, featById.get(String(other._id))!);
      if (s > best) best = s;
    }
    return best;
  };

  const chosen = selectReciprocalMatch(
    ranked.map((r) => ({ item: r, score: r.score })),
    bestAlternativeScore,
    RECIPROCITY_FACTOR
  );
  return chosen ? { candidate: chosen.candidate, score: chosen.score } : null;
}

// Public wrapper that returns just the best-matching user (the score is dropped).
export async function findBestCandidate(requester: UserDoc): Promise<UserDoc | null> {
  const best = await findBestCandidateWithScore(requester);
  return best?.candidate ?? null;
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
  // +select the face fields so the requester side of the Phase-2 taste blend
  // (candidate's taste vs requester's face) is available at score time.
  const requester = await UserModel.findById(userId).select(
    '+faceEmbedding +faceTasteVector +faceTasteMargin +faceTasteLikes +faceTasteDislikes'
  );
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

  // A user who actively SKIPPED is in a cooldown — no new match until it lifts.
  // (Being skipped by someone else sets no cooldown, so that person gets a match
  // right away.) Applies in both phases.
  const cooldownUntil = requester.get('cooldownUntil') as Date | null | undefined;
  if (cooldownUntil && cooldownUntil.getTime() > Date.now()) {
    return null;
  }

  const inLearning = learningDay(requester) < LEARNING_DAYS;
  if (phase === 'phase_1' && !inLearning) {
    // Learning period is over → promote to phase 2 and FALL THROUGH to try a
    // curated match (rather than returning null). Returning null here used to
    // strand any client still calling the daily endpoint with a stale local
    // phase: it never learned to switch to the phase-2 flow, so it re-requested
    // phase 1 forever and saw "no match" permanently.
    await UserModel.updateOne({ _id: requester._id }, { currentPhase: 'phase_2' });
    phase = 'phase_2';
  }

  if (phase === 'phase_2') {
    if (inLearning) {
      return null;
    }
    const lastPhase2 = await MatchModel.findOne({
      userId: requester._id,
      phase: 'phase_2',
    }).sort({ createdAt: -1 });
    if (
      lastPhase2 &&
      Date.now() - new Date(lastPhase2.createdAt).getTime() <
        PHASE2_CADENCE_DAYS * DAY_MS
    ) {
      return null;
    }
  }

  const best = await findBestCandidateWithScore(requester, phase);
  if (!best) return null;

  const { candidate, score: learnedScore } = best;
  if (phase === 'phase_2' && learnedScore < PHASE2_QUALITY_THRESHOLD) {
    return null;
  }

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
export function toClientMatch(
  match: MatchDoc,
  candidate: UserDoc,
  opts?: { cooldownUntil?: Date | null }
) {
  const cooldownUntil = opts?.cooldownUntil ?? null;
  const cooldownActive = cooldownUntil ? cooldownUntil.getTime() > Date.now() : false;
  const photos = (candidate.get('photos') as string[] | undefined) ?? [];
  const primaryPhoto = photos[0] ?? candidate.photoUrl ?? undefined;
  const writtenBio = (candidate.get('bio') as string | undefined)?.trim();
  return {
    matchId: String(match._id),
    status: match.status,
    phase: match.phase, // so the client can sync its local phase to reality
    conversationId: match.conversationId ?? undefined,
    candidateName: candidate.name,
    candidateAge: candidate.age,
    candidateBio: writtenBio || synthesizeBio(candidate),
    candidatePhotoUrl: primaryPhoto,
    candidatePhotos: photos.length > 0 ? photos : primaryPhoto ? [primaryPhoto] : [],
    candidateInterests: (candidate.get('interestTags') as string[] | undefined) ?? [],
    candidateIntent: candidate.profile?.intent,
    candidateCommStyle: candidate.profile?.commStyle,
    expiresAt: match.expiresAt.toISOString(),
    dayInLearningPeriod: match.dayInLearningPeriod ?? undefined,
    totalLearningDays: match.phase === 'phase_1' ? LEARNING_DAYS : undefined,
    isIntentionalPairing: match.isIntentionalPairing ?? undefined,
    cooldownActive,
  };
}
