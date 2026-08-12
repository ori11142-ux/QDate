// Swipe service: records calibration swipes (interests & looks) and reports
// per-deck like-rates. A "looks" swipe also retrains the user's visual taste.
import { Types } from 'mongoose';
import { SwipeDoc, SwipeModel } from '../models/Swipe';
import { updateFaceTaste } from '../ml/faceTaste';

export type RecordSwipeInput = {
  userId: string | Types.ObjectId;
  cardId: string;
  mode: 'interests' | 'looks';
  liked: boolean;
  responseTimeMs?: number;
};

// Save one calibration swipe; for a "looks" swipe, also recompute face-taste in the background.
export async function recordSwipe(input: RecordSwipeInput): Promise<SwipeDoc> {
  const swipe = await SwipeModel.create({ ...input, swipedAt: new Date() });
  // A looks-swipe changes this user's visual taste — recompute in the background,
  // mirroring the face-embedding trigger. Never blocks POST /swipes.
  if (input.mode === 'looks') {
    void updateFaceTaste(String(input.userId));
  }
  return swipe;
}

export async function listSwipesForUser(
  userId: string | Types.ObjectId,
  mode?: 'interests' | 'looks',
  limit = 200
): Promise<SwipeDoc[]> {
  const query: Record<string, unknown> = { userId };
  if (mode) query.mode = mode;
  return SwipeModel.find(query).sort({ swipedAt: -1 }).limit(limit);
}

/**
 * Like-rate per mode — quick sanity check that a user has signal in both decks.
 * Returns { interests: 0.42, looks: 0.61 } etc., or null for a mode they haven't tried.
 */
export async function getLikeRates(
  userId: string | Types.ObjectId
): Promise<{ interests: number | null; looks: number | null }> {
  const agg = await SwipeModel.aggregate([
    { $match: { userId: new Types.ObjectId(String(userId)) } },
    {
      $group: {
        _id: '$mode',
        total: { $sum: 1 },
        liked: { $sum: { $cond: ['$liked', 1, 0] } },
      },
    },
  ]);

  const out: { interests: number | null; looks: number | null } = {
    interests: null,
    looks: null,
  };
  for (const row of agg) {
    const rate = row.total > 0 ? row.liked / row.total : null;
    if (row._id === 'interests') out.interests = rate;
    else if (row._id === 'looks') out.looks = rate;
  }
  return out;
}
