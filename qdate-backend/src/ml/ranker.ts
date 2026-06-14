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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function compatibilityByDiff(diff: number, maxDiff: number): number {
  if (maxDiff <= 0) return 0;
  return clamp(1 - diff / maxDiff, 0, 1);
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

const BASE_WEIGHTS: LearnedWeights = {
  intent: 0.2,
  commStyle: 0.14,
  age: 0.08,
  intellect: 0.08,
  activityOverlap: 0.1,
  cadence: 0.1,
  engagement: 0.08,
  interests: 0.11,
  looks: 0.08,
  outcomeConfidence: 0.03,
};

function normalizeWeights(weights: LearnedWeights): LearnedWeights {
  const total = Object.values(weights).reduce((acc, v) => acc + v, 0);
  if (total === 0) return BASE_WEIGHTS;
  return Object.fromEntries(
    Object.entries(weights).map(([k, v]) => [k, v / total])
  ) as LearnedWeights;
}

async function learnWeightsFromOutcomes(): Promise<LearnedWeights> {
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

  const learned: LearnedWeights = {
    ...BASE_WEIGHTS,
    intent: BASE_WEIGHTS.intent + connectedRate * 0.06,
    commStyle: BASE_WEIGHTS.commStyle + communication * 0.04,
    cadence: BASE_WEIGHTS.cadence + (1 - inactiveRate) * 0.03,
    engagement: BASE_WEIGHTS.engagement + communication * 0.03,
    interests: BASE_WEIGHTS.interests + willingness * 0.03,
    looks: BASE_WEIGHTS.looks + willingness * 0.02,
    outcomeConfidence: BASE_WEIGHTS.outcomeConfidence + connectedRate * 0.02,
    age: BASE_WEIGHTS.age,
    intellect: BASE_WEIGHTS.intellect,
    activityOverlap: BASE_WEIGHTS.activityOverlap,
  };

  return normalizeWeights(learned);
}

function scoreFromFeatures(
  requester: UserFeatureVector,
  candidate: UserFeatureVector,
  learnedWeights: LearnedWeights
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

  const interestsCompat =
    (preferenceAlignment(requester.interestsPreference, candidate.interestTags) +
      preferenceAlignment(candidate.interestsPreference, requester.interestTags) +
      preferenceVectorSimilarity(requester.interestsPreference, candidate.interestsPreference)) /
    3;

  const looksCompat =
    (preferenceAlignment(requester.looksPreference, candidate.appearanceTags) +
      preferenceAlignment(candidate.looksPreference, requester.appearanceTags) +
      preferenceVectorSimilarity(requester.looksPreference, candidate.looksPreference)) /
    3;

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

export async function scoreCandidateWithLearning(
  requester: UserDoc,
  candidate: UserDoc
): Promise<number> {
  const [requesterFeatures, candidateFeatures, weights] = await Promise.all([
    extractUserFeatures(requester),
    extractUserFeatures(candidate),
    learnWeightsFromOutcomes(),
  ]);

  return scoreFromFeatures(requesterFeatures, candidateFeatures, weights);
}

export function scoreCandidateHeuristicML(requester: UserDoc, candidate: UserDoc): number {
  return scoreProfileOnly(requester, candidate);
}
