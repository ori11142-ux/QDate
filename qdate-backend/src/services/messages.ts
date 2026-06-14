import { Types } from 'mongoose';
import { MessageDoc, MessageModel } from '../models/Message';

export type RecordMessageInput = {
  matchId: string | Types.ObjectId;
  senderId: string | Types.ObjectId;
  text: string;
};

/**
 * Persist a chat message. Computes response latency relative to the most recent
 * message from the OTHER party. Returns the saved document.
 */
export async function recordMessage(input: RecordMessageInput): Promise<MessageDoc> {
  const { matchId, senderId, text } = input;

  // Find the most recent message in this conversation NOT from this sender.
  const lastFromOther = await MessageModel.findOne({
    matchId,
    senderId: { $ne: senderId },
  })
    .sort({ sentAt: -1 })
    .select('sentAt');

  const now = new Date();
  const responseTimeSeconds = lastFromOther
    ? Math.max(0, Math.floor((now.getTime() - lastFromOther.sentAt.getTime()) / 1000))
    : null;

  return MessageModel.create({
    matchId,
    senderId,
    text,
    messageLength: text.length,
    responseTimeSeconds,
    sentAt: now,
  });
}

export async function listMessagesForMatch(
  matchId: string | Types.ObjectId,
  limit = 200
): Promise<MessageDoc[]> {
  return MessageModel.find({ matchId }).sort({ sentAt: 1 }).limit(limit);
}

/**
 * Mark every unread message from the OTHER party in this match as read.
 * Useful when the user opens the chat — feeds the read-latency signal.
 */
export async function markMessagesReadForUser(
  matchId: string | Types.ObjectId,
  readerId: string | Types.ObjectId
): Promise<number> {
  const result = await MessageModel.updateMany(
    { matchId, senderId: { $ne: readerId }, readAt: null },
    { readAt: new Date() }
  );
  return result.modifiedCount;
}

/**
 * Behavioral stat — average reply latency for a user across all their conversations.
 * Used by the ML pipeline to feed the intent score.
 */
export async function getAvgResponseTimeSeconds(
  senderId: string | Types.ObjectId,
  sinceDays = 30
): Promise<number | null> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const agg = await MessageModel.aggregate([
    { $match: { senderId: new Types.ObjectId(String(senderId)), sentAt: { $gte: since }, responseTimeSeconds: { $ne: null } } },
    { $group: { _id: null, avg: { $avg: '$responseTimeSeconds' } } },
  ]);
  return agg[0]?.avg ?? null;
}

export async function countMessagesForUserInLastDays(
  senderId: string | Types.ObjectId,
  days = 7
): Promise<number> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return MessageModel.countDocuments({ senderId, sentAt: { $gte: since } });
}

// ─── Conversation-based chat (mutual pairings share a conversationId) ─────────

export type RecordConversationMessageInput = {
  conversationId: string;
  senderId: string | Types.ObjectId;
  text: string;
};

/**
 * Persist a message in a shared conversation. Computes response latency relative
 * to the most recent message from the OTHER participant.
 */
export async function recordConversationMessage(
  input: RecordConversationMessageInput
): Promise<MessageDoc> {
  const { conversationId, senderId, text } = input;

  const lastFromOther = await MessageModel.findOne({
    conversationId,
    senderId: { $ne: senderId },
  })
    .sort({ sentAt: -1 })
    .select('sentAt');

  const now = new Date();
  const responseTimeSeconds = lastFromOther
    ? Math.max(0, Math.floor((now.getTime() - lastFromOther.sentAt.getTime()) / 1000))
    : null;

  return MessageModel.create({
    conversationId,
    senderId,
    text,
    messageLength: text.length,
    responseTimeSeconds,
    sentAt: now,
  });
}

export async function listConversationMessages(
  conversationId: string,
  limit = 500
): Promise<MessageDoc[]> {
  return MessageModel.find({ conversationId }).sort({ sentAt: 1 }).limit(limit);
}
