import { Types } from 'mongoose';
import { User, UserDoc, UserModel } from '../models/User';

export type CreateUserInput = {
  email: string;
  name: string;
  age: number;
  authMethod: 'email' | 'apple' | 'google';
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

export type ProfileUpdate = Partial<
  Pick<
    User,
    | 'name'
    | 'age'
    | 'gender'
    | 'attraction'
    | 'agePreference'
    | 'photoUrl'
    | 'photos'
    | 'bio'
    | 'profile'
    | 'interestTags'
    | 'appearanceTags'
  >
>;

/** Clamp a preferred age range to valid values (18–99, min ≤ max). */
export function sanitizeAgePreference(pref: unknown): { min: number; max: number } {
  const p = (pref ?? {}) as { min?: unknown; max?: unknown };
  const clamp = (v: unknown, def: number) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : def;
    return Math.max(18, Math.min(99, n));
  };
  let min = clamp(p.min, 18);
  let max = clamp(p.max, 99);
  if (min > max) [min, max] = [max, min];
  return { min, max };
}

export async function updateUserProfile(
  id: string | Types.ObjectId,
  updates: ProfileUpdate
): Promise<UserDoc | null> {
  // runValidators so enum/range constraints (age, gender, intent, …) are
  // enforced on edits the same way they are on creation.
  return UserModel.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
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

/**
 * Nudge a user's intent score by `delta`, clamped to [0, 10]. Used to reflect
 * engagement actions (connecting to a match raises it; skipping lowers it).
 * Atomic clamp via an aggregation-pipeline update so concurrent nudges are safe.
 */
export async function adjustIntentScore(
  id: string | Types.ObjectId,
  delta: number
): Promise<void> {
  await UserModel.updateOne({ _id: id }, [
    {
      $set: {
        intentScore: {
          $max: [0, { $min: [10, { $add: [{ $ifNull: ['$intentScore', 5] }, delta] }] }],
        },
      },
    },
  ]);
}
