import { Types } from 'mongoose';
import { UserDoc } from '../models/User';
import { MessageModel } from '../models/Message';
import { SwipeModel } from '../models/Swipe';
import { FeedbackModel } from '../models/Feedback';
import { CARD_TAGS_BY_ID, CalibrationTag } from './calibrationCards';

export type PreferenceVector = Partial<Record<CalibrationTag, number>>;

export type UserFeatureVector = {
  userId: string;
  age: number;
  intentScore: number;
  intent: 'long_term' | 'casual' | 'explore' | 'friendship';
  commStyle: 'texting_first' | 'voice_early' | 'meet_in_person';
  sharedIntellectImportance: number;
  avgReplyLatencySeconds: number | null;
  medianReplyLatencySeconds: number | null;
  messageFrequencyPerDay: number;
  avgMessageLength: number;
  avgReadLatencySeconds: number | null;
  activityBuckets: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
  };
  interestsPreference: PreferenceVector;
  looksPreference: PreferenceVector;
  feedbackWillingnessAvg: number | null;
  feedbackCommunicationAvg: number | null;
  interestTags: string[];
  appearanceTags: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function confidenceFromResponseMs(responseTimeMs: number | null | undefined): number {
  if (responseTimeMs == null) return 1;
  if (responseTimeMs <= 1500) return 1.2;
  if (responseTimeMs <= 5000) return 1;
  return 0.8;
}

function normalizeVector(raw: Record<CalibrationTag, number>): PreferenceVector {
  const sumAbs = Object.values(raw).reduce((acc, v) => acc + Math.abs(v), 0);
  if (sumAbs <= 0) return {};
  const normalized: PreferenceVector = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === 0) continue;
    normalized[k as CalibrationTag] = clamp(v / sumAbs, -1, 1);
  }
  return normalized;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let an = 0;
  let bn = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    an += a[i] * a[i];
    bn += b[i] * b[i];
  }
  if (an === 0 || bn === 0) return 0;
  return clamp(dot / (Math.sqrt(an) * Math.sqrt(bn)), -1, 1);
}

function preferenceToArray(pref: PreferenceVector): number[] {
  const tags = Object.keys(CARD_TAGS_BY_ID)
    .flatMap((cardId) => CARD_TAGS_BY_ID[cardId])
    .filter((value, index, self) => self.indexOf(value) === index)
    .sort();
  return tags.map((t) => pref[t] ?? 0);
}

export function preferenceAlignment(preferences: PreferenceVector, candidateTags: string[]): number {
  if (candidateTags.length === 0) return 0.5;
  let score = 0;
  let matched = 0;
  for (const tag of candidateTags) {
    const axis = tag as CalibrationTag;
    const v = preferences[axis];
    if (v == null) continue;
    matched += 1;
    score += v;
  }
  if (matched === 0) return 0.5;
  return clamp((score / matched + 1) / 2, 0, 1);
}

export function activityOverlap(a: UserFeatureVector['activityBuckets'], b: UserFeatureVector['activityBuckets']): number {
  const av = [a.morning, a.afternoon, a.evening, a.night];
  const bv = [b.morning, b.afternoon, b.evening, b.night];
  return (cosineSimilarity(av, bv) + 1) / 2;
}

export async function buildPreferenceVector(
  userId: string | Types.ObjectId,
  mode: 'interests' | 'looks'
): Promise<PreferenceVector> {
  const swipes = await SwipeModel.find({ userId, mode }).select('cardId liked responseTimeMs').lean();
  if (swipes.length === 0) return {};

  const accum: Record<CalibrationTag, number> = {
    active_lifestyle: 0,
    creative_arts: 0,
    intellectual_curiosity: 0,
    social_energy: 0,
    homebody_rhythm: 0,
    outdoor_energy: 0,
    mindful_service: 0,
    adventure: 0,
    polished_style: 0,
    natural_style: 0,
    playful_energy: 0,
    minimalist_style: 0,
    expressive_style: 0,
    confident_presence: 0,
  };

  for (const swipe of swipes) {
    const tags = CARD_TAGS_BY_ID[swipe.cardId] ?? [];
    if (tags.length === 0) continue;
    const polarity = swipe.liked ? 1 : -1;
    const confidence = confidenceFromResponseMs(swipe.responseTimeMs ?? null);
    for (const tag of tags) {
      accum[tag] += polarity * confidence;
    }
  }

  return normalizeVector(accum);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[m - 1] + sorted[m]) / 2;
  }
  return sorted[m];
}

function bucketForHour(hour: number): keyof UserFeatureVector['activityBuckets'] {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 24) return 'evening';
  return 'night';
}

export async function extractUserFeatures(user: UserDoc): Promise<UserFeatureVector> {
  const since = new Date(Date.now() - 30 * DAY_MS);
  const uid = new Types.ObjectId(String(user._id));

  const [messages, sentAndReadForUser, interestsPreference, looksPreference, feedbackAgg] = await Promise.all([
    MessageModel.find({ senderId: uid, sentAt: { $gte: since } })
      .select('responseTimeSeconds sentAt messageLength')
      .lean(),
    MessageModel.find({ senderId: uid, readAt: { $ne: null }, sentAt: { $gte: since } })
      .select('sentAt readAt')
      .lean(),
    buildPreferenceVector(uid, 'interests'),
    buildPreferenceVector(uid, 'looks'),
    FeedbackModel.aggregate([
      { $match: { userId: uid } },
      {
        $group: {
          _id: null,
          willingnessAvg: { $avg: '$willingnessToMeet' },
          communicationAvg: { $avg: '$communicationCompatibility' },
        },
      },
    ]),
  ]);

  const replyLatencies = messages
    .map((m) => m.responseTimeSeconds)
    .filter((v): v is number => typeof v === 'number');
  const avgReplyLatencySeconds =
    replyLatencies.length > 0
      ? replyLatencies.reduce((acc, v) => acc + v, 0) / replyLatencies.length
      : null;

  const avgMessageLength =
    messages.length > 0
      ? messages.reduce((acc, m) => acc + (m.messageLength ?? 0), 0) / messages.length
      : 0;

  const activityCounts: UserFeatureVector['activityBuckets'] = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
  };

  for (const msg of messages) {
    const date = new Date(msg.sentAt);
    activityCounts[bucketForHour(date.getHours())] += 1;
  }

  const totalActivity =
    activityCounts.morning + activityCounts.afternoon + activityCounts.evening + activityCounts.night;
  const activityBuckets = totalActivity
    ? {
        morning: activityCounts.morning / totalActivity,
        afternoon: activityCounts.afternoon / totalActivity,
        evening: activityCounts.evening / totalActivity,
        night: activityCounts.night / totalActivity,
      }
    : {
        morning: 0.25,
        afternoon: 0.25,
        evening: 0.25,
        night: 0.25,
      };

  const readLatencies = sentAndReadForUser
    .map((m) => {
      if (!m.readAt) return null;
      return Math.max(0, Math.floor((new Date(m.readAt).getTime() - new Date(m.sentAt).getTime()) / 1000));
    })
    .filter((v): v is number => typeof v === 'number');

  const avgReadLatencySeconds =
    readLatencies.length > 0 ? readLatencies.reduce((acc, v) => acc + v, 0) / readLatencies.length : null;

  const feedback = feedbackAgg[0] as { willingnessAvg?: number; communicationAvg?: number } | undefined;

  const profile = user.profile ?? {
    intent: 'explore' as const,
    commStyle: 'texting_first' as const,
    sharedIntellectImportance: 3,
  };

  return {
    userId: String(user._id),
    age: user.age,
    intentScore: user.intentScore ?? 5,
    intent: profile.intent,
    commStyle: profile.commStyle,
    sharedIntellectImportance: profile.sharedIntellectImportance,
    avgReplyLatencySeconds,
    medianReplyLatencySeconds: median(replyLatencies),
    messageFrequencyPerDay: messages.length / 30,
    avgMessageLength,
    avgReadLatencySeconds,
    activityBuckets,
    interestsPreference,
    looksPreference,
    feedbackWillingnessAvg: feedback?.willingnessAvg ?? null,
    feedbackCommunicationAvg: feedback?.communicationAvg ?? null,
    interestTags: (user.get('interestTags') as string[] | undefined) ?? [],
    appearanceTags: (user.get('appearanceTags') as string[] | undefined) ?? [],
  };
}

export function preferenceVectorSimilarity(a: PreferenceVector, b: PreferenceVector): number {
  const aVec = preferenceToArray(a);
  const bVec = preferenceToArray(b);
  return (cosineSimilarity(aVec, bVec) + 1) / 2;
}
