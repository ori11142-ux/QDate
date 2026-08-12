// The master list of interests users can pick at sign-up, plus a helper that keeps
// only valid, de-duplicated picks. Each interest doubles as a matching-model axis.
import { CalibrationTag } from '../ml/calibrationCards';

// User-selectable interests. Each maps to a matching-model CalibrationTag axis,
// so a user's chosen interestTags line up with the preference vectors the ranker
// builds from calibration swipes (see src/ml/ranker.ts).
export type InterestOption = {
  tag: CalibrationTag;
  label: string;
  emoji: string;
};

export const INTEREST_OPTIONS: InterestOption[] = [
  { tag: 'hiking', label: 'Hiking', emoji: '🥾' },
  { tag: 'running', label: 'Running', emoji: '🏃' },
  { tag: 'fitness', label: 'Fitness', emoji: '🏋️' },
  { tag: 'yoga', label: 'Yoga', emoji: '🧘' },
  { tag: 'cooking', label: 'Cooking', emoji: '🍳' },
  { tag: 'foodie', label: 'Foodie', emoji: '🍜' },
  { tag: 'coffee', label: 'Coffee', emoji: '☕' },
  { tag: 'live_music', label: 'Live music', emoji: '🎶' },
  { tag: 'reading', label: 'Reading', emoji: '📚' },
  { tag: 'art', label: 'Art & galleries', emoji: '🎨' },
  { tag: 'photography', label: 'Photography', emoji: '📷' },
  { tag: 'film', label: 'Film & TV', emoji: '🎬' },
  { tag: 'travel', label: 'Travel', emoji: '✈️' },
  { tag: 'gaming', label: 'Gaming', emoji: '🎮' },
  { tag: 'nature', label: 'Nature', emoji: '🌿' },
  { tag: 'volunteering', label: 'Volunteering', emoji: '🤝' },
  { tag: 'nightlife', label: 'Nightlife', emoji: '🍸' },
  { tag: 'pets', label: 'Pets', emoji: '🐾' },
];

// Each user picks exactly this many interests.
export const INTEREST_PICK_COUNT = 5;

export const INTEREST_TAGS: CalibrationTag[] = INTEREST_OPTIONS.map((o) => o.tag);
const INTEREST_TAG_SET = new Set<string>(INTEREST_TAGS);

/** Keep only recognized interest tags, de-duplicated, capped at the pick count. */
export function sanitizeInterestTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const value of input) {
    if (typeof value === 'string' && INTEREST_TAG_SET.has(value)) {
      seen.add(value);
    }
  }
  return [...seen].slice(0, INTEREST_PICK_COUNT);
}
