import { Types } from 'mongoose';
import { SwipeModel } from '../models/Swipe';
import {
  INTEREST_CALIBRATION_DECK,
  LOOK_CALIBRATION_DECK,
  InterestCalibrationCard,
  LookCalibrationCard,
} from '../ml/calibrationCards';

async function unseenFirst<T extends { id: string }>(
  userId: string | Types.ObjectId,
  mode: 'interests' | 'looks',
  deck: T[]
): Promise<T[]> {
  const seen = await SwipeModel.distinct('cardId', { userId, mode });
  const seenSet = new Set(seen);
  const unseen = deck.filter((c) => !seenSet.has(c.id));
  const alreadySeen = deck.filter((c) => seenSet.has(c.id));
  return [...unseen, ...alreadySeen];
}

export async function getInterestCalibrationDeck(
  userId: string | Types.ObjectId
): Promise<InterestCalibrationCard[]> {
  return unseenFirst(userId, 'interests', INTEREST_CALIBRATION_DECK);
}

export async function getLookCalibrationDeck(
  userId: string | Types.ObjectId
): Promise<LookCalibrationCard[]> {
  return unseenFirst(userId, 'looks', LOOK_CALIBRATION_DECK);
}
