import { Types } from 'mongoose';
import { FeedbackDoc, FeedbackModel } from '../models/Feedback';
import { MessageEventDoc, MessageEventModel } from '../models/MessageEvent';
import { MatchModel } from '../models/Match';
import { UserModel } from '../models/User';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

async function updateIntentScoreWithDelta(userId: string | Types.ObjectId, delta: number): Promise<void> {
  const user = await UserModel.findById(userId).select('intentScore');
  if (!user) throw new Error('User not found');
  const next = clamp((user.intentScore ?? 5) + delta, 0, 10);
  user.intentScore = next;
  user.lastActiveAt = new Date();
  await user.save();
}

export async function recordMessageEvent(input: {
  matchId: string;
  senderId: string;
  messageLength: number;
  responseTimeSeconds: number;
}): Promise<MessageEventDoc> {
  const event = await MessageEventModel.create({
    matchId: new Types.ObjectId(input.matchId),
    senderId: new Types.ObjectId(input.senderId),
    messageLength: input.messageLength,
    responseTimeSeconds: input.responseTimeSeconds,
    recordedAt: new Date(),
  });

  let delta = 0;
  if (input.messageLength >= 20) delta += 0.15;
  else if (input.messageLength <= 4) delta -= 0.12;

  if (input.responseTimeSeconds <= 3600) delta += 0.2;
  else if (input.responseTimeSeconds <= 6 * 3600) delta += 0.08;
  else if (input.responseTimeSeconds >= 24 * 3600) delta -= 0.18;

  await updateIntentScoreWithDelta(input.senderId, delta);
  return event;
}

export async function recordFeedback(input: {
  matchId: string;
  userId: string;
  willingnessToMeet: number;
  communicationCompatibility: number;
}): Promise<FeedbackDoc> {
  const match = await MatchModel.findById(input.matchId);
  if (!match) {
    throw new Error('Match not found');
  }

  const feedback = await FeedbackModel.create({
    matchId: new Types.ObjectId(input.matchId),
    userId: new Types.ObjectId(input.userId),
    willingnessToMeet: clamp(input.willingnessToMeet, 1, 5),
    communicationCompatibility: clamp(input.communicationCompatibility, 1, 5),
  });

  const normalized = (feedback.willingnessToMeet + feedback.communicationCompatibility) / 10;
  const targetIntent = 3 + normalized * 7;

  const user = await UserModel.findById(input.userId).select('intentScore');
  if (!user) throw new Error('User not found');
  const next = clamp((user.intentScore ?? 5) * 0.7 + targetIntent * 0.3, 0, 10);
  user.intentScore = next;
  user.lastActiveAt = new Date();
  await user.save();

  return feedback;
}
