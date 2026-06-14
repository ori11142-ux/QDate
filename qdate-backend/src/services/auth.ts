import bcrypt from 'bcryptjs';
import { UserModel, UserDoc } from '../models/User';

const SALT_ROUNDS = 10;

export class AuthError extends Error {
  constructor(public code: 'EMAIL_EXISTS' | 'INVALID_CREDENTIALS', message: string) {
    super(message);
  }
}

export type RegisterInput = {
  email: string;
  name: string;
  age: number;
  authMethod: 'email' | 'apple';
  password: string;
  photoUrl?: string | null;
  gender?: 'man' | 'woman' | null;
  attraction?: 'men' | 'women' | 'both' | null;
  profile: {
    intent: 'long_term' | 'casual' | 'explore' | 'friendship';
    sharedIntellectImportance: number;
    commStyle: 'texting_first' | 'voice_early' | 'meet_in_person';
  };
};

/**
 * Create a new account with a hashed password. Throws AuthError('EMAIL_EXISTS')
 * if the email is already registered.
 */
export async function registerWithPassword(input: RegisterInput): Promise<UserDoc> {
  const email = input.email.toLowerCase().trim();

  const existing = await UserModel.findOne({ email });
  if (existing) {
    throw new AuthError('EMAIL_EXISTS', 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  return UserModel.create({
    email,
    name: input.name,
    age: input.age,
    authMethod: input.authMethod,
    photoUrl: input.photoUrl ?? null,
    gender: input.gender ?? null,
    attraction: input.attraction ?? null,
    passwordHash,
    profile: input.profile,
  });
}

/**
 * Verify an email + password pair. Returns the user on success, or throws
 * AuthError('INVALID_CREDENTIALS') — deliberately the same error whether the
 * email is unknown or the password is wrong (don't leak which accounts exist).
 */
export async function verifyLogin(email: string, password: string): Promise<UserDoc> {
  const user = await UserModel.findOne({ email: email.toLowerCase().trim() }).select(
    '+passwordHash'
  );

  if (!user || !user.passwordHash) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  user.lastActiveAt = new Date();
  await user.save();
  return user;
}
