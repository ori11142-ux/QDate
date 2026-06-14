import { Types } from 'mongoose';
import { User, UserDoc, UserModel } from '../models/User';

export type CreateUserInput = {
  email: string;
  name: string;
  age: number;
  authMethod: 'email' | 'apple';
  gender?: 'man' | 'woman' | null;
  attraction?: 'men' | 'women' | 'both' | null;
  photoUrl?: string | null;
  interestTags?: string[];
  appearanceTags?: string[];
  profile: {
    intent: 'long_term' | 'casual' | 'explore' | 'friendship';
    sharedIntellectImportance: number;
    commStyle: 'texting_first' | 'voice_early' | 'meet_in_person';
  };
};

export async function createUser(input: CreateUserInput): Promise<UserDoc> {
  return UserModel.create(input);
}

export async function findUserById(id: string | Types.ObjectId): Promise<UserDoc | null> {
  return UserModel.findById(id);
}

export async function findUserByEmail(email: string): Promise<UserDoc | null> {
  return UserModel.findOne({ email: email.toLowerCase().trim() });
}

export async function updateUserProfile(
  id: string | Types.ObjectId,
  updates: Partial<Pick<User, 'name' | 'age' | 'profile'>>
): Promise<UserDoc | null> {
  return UserModel.findByIdAndUpdate(id, updates, { new: true });
}

export async function setUserPhase(
  id: string | Types.ObjectId,
  phase: 'phase_1' | 'phase_2'
): Promise<UserDoc | null> {
  return UserModel.findByIdAndUpdate(id, { currentPhase: phase }, { new: true });
}

/**
 * Called by the ML pipeline. Allowed to drift outside 0–10 in service code
 * only because the schema enforces the clamp.
 */
export async function setIntentScore(
  id: string | Types.ObjectId,
  intentScore: number
): Promise<UserDoc | null> {
  return UserModel.findByIdAndUpdate(id, { intentScore }, { new: true });
}

export async function touchLastActive(id: string | Types.ObjectId): Promise<void> {
  await UserModel.updateOne({ _id: id }, { lastActiveAt: new Date() });
}
