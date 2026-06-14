import { Types } from 'mongoose';
import { UserModel } from '../models/User';
import { MatchModel } from '../models/Match';
import { MessageModel } from '../models/Message';
import { getAvgResponseTimeSeconds, countMessagesForUserInLastDays } from './messages';
import { getLikeRates } from './swipes';

export type InsightsSummary = {
  intentScore: number;
  avgReplyTimeHours: number | null;
  messagesSentLast7Days: number;
  totalMessages: number;
  matchOutcomes: {
    connected: number;
    skipped: number;
    expired: number;
    pendingOrActive: number;
  };
  calibration: { interests: number | null; looks: number | null };
  reflections: { matchId: string; name: string; age: number; reason: string }[];
};

/**
 * Compute a user's real statistics from their data in MongoDB:
 * intent score, messaging behaviour, match outcomes, calibration like-rates,
 * and a few reflection prompts drawn from matches that didn't work out.
 */
export async function computeInsights(userId: string): Promise<InsightsSummary> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  const uid = new Types.ObjectId(String(userId));

  // Messaging behaviour
  const avgSeconds = await getAvgResponseTimeSeconds(userId, 30);
  const avgReplyTimeHours = avgSeconds != null ? avgSeconds / 3600 : null;
  const messagesSentLast7Days = await countMessagesForUserInLastDays(userId, 7);
  const totalMessages = await MessageModel.countDocuments({ senderId: uid });

  // Match outcomes (this user's own match documents, grouped by status)
  const outcomeAgg = await MatchModel.aggregate([
    { $match: { userId: uid } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const matchOutcomes = { connected: 0, skipped: 0, expired: 0, pendingOrActive: 0 };
  for (const row of outcomeAgg) {
    if (row._id === 'connected') matchOutcomes.connected += row.count;
    else if (row._id === 'skipped') matchOutcomes.skipped += row.count;
    else if (row._id === 'expired') matchOutcomes.expired += row.count;
    else if (row._id === 'pending_reveal' || row._id === 'active') {
      matchOutcomes.pendingOrActive += row.count;
    }
  }

  // Calibration like-rates per deck
  const calibration = await getLikeRates(userId);

  // Reflection prompts from matches that ended without connecting
  const ended = await MatchModel.find({
    userId: uid,
    status: { $in: ['skipped', 'expired'] },
  })
    .sort({ updatedAt: -1 })
    .limit(3);

  const reflections: InsightsSummary['reflections'] = [];
  for (const m of ended) {
    const cand = await UserModel.findById(m.candidateUserId);
    if (!cand) continue;
    reflections.push({
      matchId: String(m._id),
      name: cand.name,
      age: cand.age,
      reason:
        m.status === 'skipped'
          ? 'You skipped this match — what felt off?'
          : 'This one expired before you connected. Timing matters.',
    });
  }

  return {
    intentScore: user.intentScore ?? 5,
    avgReplyTimeHours,
    messagesSentLast7Days,
    totalMessages,
    matchOutcomes,
    calibration,
    reflections,
  };
}
