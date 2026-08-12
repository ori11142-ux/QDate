// The ranker: scores how compatible two users are (0-100) by weighting many
// signals - intent, communication style, age, interests, and looks (which folds
// in the learned face-taste model). Weights can adapt to real match outcomes.
import { MatchModel } from '../models/Match';
import { UserDoc } from '../models/User';
import { FeedbackModel } from '../models/Feedback';
import {
  UserFeatureVector,
  activityOverlap,
  extractUserFeatures,
  preferenceAlignment,
  preferenceVectorSimilarity,
} from './features';
import { faceTasteBlendTerm, getGlobalUsableTasteUsers } from './faceTaste';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function compatibilityByDiff(diff: number, maxDiff: number): number {
  if (maxDiff <= 0) return 0;
  return clamp(1 - diff / maxDiff, 0, 1);
}

/** Overlap of two selected-tag sets: |A∩B| / max(|A|,|B|). Neutral 0.5 if either is empty. */
function tagOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0.5;
  const setB = new Set(b);
  const inter = a.filter((t) => setB.has(t)).length;
  return inter / Math.max(a.length, b.length);
}

function commStyleCompatibility(a: UserFeatureVector['commStyle'], b: UserFeatureVector['commStyle']): number {
  if (a === b) return 1;
  if (
    (a === 'texting_first' && b === 'voice_early') ||
    (a === 'voice_early' && b === 'texting_first')
  ) {
    return 0.6;
  }
  if (
    (a === 'meet_in_person' && b === 'voice_early') ||
    (a === 'voice_early' && b === 'meet_in_person')
  ) {
    return 0.75;
  }
  return 0.45;
}

type LearnedWeights = {
  intent: number;
  commStyle: number;
  age: number;
  intellect: number;
  activityOverlap: number;
  cadence: number;
  engagement: number;
  interests: number;
  looks: number;
  outcomeConfidence: number;
};

// Weights are normalized before use, so these are relative importances.
// Appearance (looks) and shared interests are deliberately prominent here:
// looks is driven by the learned face-taste model, interests by shared-tag
// overlap + learned interest preference.
const BASE_WEIGHTS: LearnedWeights = {
  intent: 0.2,
  commStyle: 0.12,
  age: 0.08,
  intellect: 0.06,
  activityOverlap: 0.04,
  cadence: 0.05,
  engagement: 0.03,
  interests: 0.18,
  looks: 0.2,
  outcomeConfidence: 0.04,
};

function normalizeWeights(weights: LearnedWeights): LearnedWeights {
  const total = Object.values(weights).reduce((acc, v) => acc + v, 0);
  if (total === 0) return BASE_WEIGHTS;
  return Object.fromEntries(
    Object.entries(weights).map(([k, v]) => [k, v / total])
  ) as LearnedWeights;
}

// Adjusts each scoring weight based on real match outcomes, once there's enough history.
// Exported for the eval/demo harnesses (evalFaceTaste.ts, demoMatching.ts).
export async function learnWeightsFromOutcomes(): Promise<LearnedWeights> {
  const [matchAgg, feedbackAgg] = await Promise.all([
    MatchModel.aggregate([
      { $match: { status: { $in: ['connected', 'skipped', 'expired'] } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    FeedbackModel.aggregate([
      {
        $group: {
          _id: null,
          willingnessAvg: { $avg: '$willingnessToMeet' },
          communicationAvg: { $avg: '$communicationCompatibility' },
        },
      },
    ]),
  ]);

  let connected = 0;
  let skipped = 0;
  let expired = 0;
  for (const row of matchAgg) {
    if (row._id === 'connected') connected = row.count;
    if (row._id === 'skipped') skipped = row.count;
    if (row._id === 'expired') expired = row.count;
  }
  const outcomesTotal = connected + skipped + expired;
  if (outcomesTotal < 8) {
    return BASE_WEIGHTS;
  }

  const connectedRate = connected / outcomesTotal;
  const inactiveRate = expired / outcomesTotal;
  const feedback = feedbackAgg[0] as { willingnessAvg?: number; communicationAvg?: number } | undefined;
  const willingness = (feedback?.willingnessAvg ?? 3) / 5;
  const communication = (feedback?.communicationAvg ?? 3) / 5;

  // MULTIPLICATIVE adjustments (relative to each base), so learning perturbs
  // every weight PROPORTIONALLY. Fixed additive bumps would inflate small-base
  // weights (e.g. engagement 0.03 → +60%) while barely moving large ones
  // (looks 0.20), and after normalization could push the deliberately-prominent
  // looks/interests below their base — reversing the intended balance.
  const learned: LearnedWeights = {
    ...BASE_WEIGHTS,
    intent: BASE_WEIGHTS.intent * (1 + connectedRate * 0.3),
    commStyle: BASE_WEIGHTS.commStyle * (1 + communication * 0.3),
    cadence: BASE_WEIGHTS.cadence * (1 + (1 - inactiveRate) * 0.3),
    engagement: BASE_WEIGHTS.engagement * (1 + communication * 0.3),
    interests: BASE_WEIGHTS.interests * (1 + willingness * 0.25),
    looks: BASE_WEIGHTS.looks * (1 + willingness * 0.2),
    outcomeConfidence: BASE_WEIGHTS.outcomeConfidence * (1 + connectedRate * 0.5),
  };

  return normalizeWeights(learned);
}

// Combines every per-signal compatibility into one weighted 0-100 match score.
// Exported (with an explicit global-taste-users arg) so tooling can score a pair
// with the taste blend forced off vs on. Production goes through scoreCandidateWithLearning.
export function scoreFromFeatures(
  requester: UserFeatureVector,
  candidate: UserFeatureVector,
  learnedWeights: LearnedWeights,
  globalUsableTasteUsers: number
): number {
  const intentCompat = requester.intent === candidate.intent ? 1 : 0.4;
  const commCompat = commStyleCompatibility(requester.commStyle, candidate.commStyle);
  const ageCompat = compatibilityByDiff(Math.abs(requester.age - candidate.age), 16);
  const intellectCompat = compatibilityByDiff(
    Math.abs(requester.sharedIntellectImportance - candidate.sharedIntellectImportance),
    4
  );

  const activityCompat = activityOverlap(requester.activityBuckets, candidate.activityBuckets);

  const cadenceCompat = compatibilityByDiff(
    Math.abs((requester.avgReplyLatencySeconds ?? 3 * 3600) - (candidate.avgReplyLatencySeconds ?? 3 * 3600)),
    18 * 3600
  );

  const engagementCompat = compatibilityByDiff(
    Math.abs(requester.avgMessageLength - candidate.avgMessageLength) +
      Math.abs(requester.messageFrequencyPerDay - candidate.messageFrequencyPerDay) * 15,
    120
  );

  // Direct overlap of the two people's SELECTED interests — this always applies,
  // even before any interests-calibration swipes exist. (The learned interest
  // preference below is neutral 0.5 until a user swipes the interests deck, so
  // without this term, the interests people pick at onboarding never affected
  // the match score.) The learned preference refines it once signal exists.
  const interestOverlap = tagOverlap(requester.interestTags, candidate.interestTags);
  const learnedInterests =
    (preferenceAlignment(requester.interestsPreference, candidate.interestTags) +
      preferenceAlignment(candidate.interestsPreference, requester.interestTags)) /
    2;
  const interestsCompat = 0.6 * interestOverlap + 0.4 * learnedInterests;

  // Phase 1 tag-based looks term (unchanged).
  const tagLooks =
    (preferenceAlignment(requester.looksPreference, candidate.appearanceTags) +
      preferenceAlignment(candidate.looksPreference, requester.appearanceTags) +
      preferenceVectorSimilarity(requester.looksPreference, candidate.looksPreference)) /
    3;

  // Phase 2: blend in the learned mutual face-taste when there's enough signal.
  // beta===0 (cold-start, or no computable direction) → looksCompat === tagLooks
  // exactly, so the Phase-1 score is reproduced byte-for-byte.
  const { mutualEmb, beta } = faceTasteBlendTerm(requester, candidate, globalUsableTasteUsers);
  const looksCompat =
    mutualEmb == null || beta === 0 ? tagLooks : (1 - beta) * tagLooks + beta * mutualEmb;

  const outcomeConfidence =
    ((requester.feedbackWillingnessAvg ?? 3) + (candidate.feedbackWillingnessAvg ?? 3)) / 10;

  const weighted =
    intentCompat * learnedWeights.intent +
    commCompat * learnedWeights.commStyle +
    ageCompat * learnedWeights.age +
    intellectCompat * learnedWeights.intellect +
    activityCompat * learnedWeights.activityOverlap +
    cadenceCompat * learnedWeights.cadence +
    engagementCompat * learnedWeights.engagement +
    interestsCompat * learnedWeights.interests +
    looksCompat * learnedWeights.looks +
    outcomeConfidence * learnedWeights.outcomeConfidence;

  return clamp(Math.round(weighted * 100), 0, 100);
}

// Fallback score from profile fields only (no learned features or DB reads).
function scoreProfileOnly(requester: UserDoc, candidate: UserDoc): number {
  const requesterProfile = requester.profile ?? {
    intent: 'explore' as const,
    commStyle: 'texting_first' as const,
    sharedIntellectImportance: 3,
  };
  const candidateProfile = candidate.profile ?? {
    intent: 'explore' as const,
    commStyle: 'texting_first' as const,
    sharedIntellectImportance: 3,
  };

  const intentCompat = requesterProfile.intent === candidateProfile.intent ? 1 : 0.4;
  const commCompat = commStyleCompatibility(requesterProfile.commStyle, candidateProfile.commStyle);
  const ageCompat = compatibilityByDiff(Math.abs(requester.age - candidate.age), 16);
  const intellectCompat = compatibilityByDiff(
    Math.abs(
      requesterProfile.sharedIntellectImportance - candidateProfile.sharedIntellectImportance
    ),
    4
  );
  const interestTags = (requester.get('interestTags') as string[] | undefined) ?? [];
  const candidateInterests = (candidate.get('interestTags') as string[] | undefined) ?? [];
  const appearanceTags = (requester.get('appearanceTags') as string[] | undefined) ?? [];
  const candidateAppearance = (candidate.get('appearanceTags') as string[] | undefined) ?? [];

  const sharedInterests =
    interestTags.length === 0 || candidateInterests.length === 0
      ? 0.5
      : interestTags.filter((tag) => candidateInterests.includes(tag)).length /
        Math.max(interestTags.length, candidateInterests.length);

  const appearanceCompat =
    appearanceTags.length === 0 || candidateAppearance.length === 0
      ? 0.5
      : appearanceTags.filter((tag) => candidateAppearance.includes(tag)).length /
        Math.max(appearanceTags.length, candidateAppearance.length);

  const score =
    intentCompat * 0.32 +
    commCompat * 0.22 +
    ageCompat * 0.18 +
    intellectCompat * 0.14 +
    sharedInterests * 0.08 +
    appearanceCompat * 0.06;

  return clamp(Math.round(score * 100), 0, 100);
}

// Main entry point: loads both users' features + learned weights and returns their 0-100 match score.
export async function scoreCandidateWithLearning(
  requester: UserDoc,
  candidate: UserDoc
): Promise<number> {
  const [requesterFeatures, candidateFeatures, weights, globalUsableTasteUsers] = await Promise.all([
    extractUserFeatures(requester),
    extractUserFeatures(candidate),
    learnWeightsFromOutcomes(),
    getGlobalUsableTasteUsers(),
  ]);

  return scoreFromFeatures(requesterFeatures, candidateFeatures, weights, globalUsableTasteUsers);
}

// Quick profile-only score, for when full feature extraction isn't warranted.
export function scoreCandidateHeuristicML(requester: UserDoc, candidate: UserDoc): number {
  return scoreProfileOnly(requester, candidate);
}
