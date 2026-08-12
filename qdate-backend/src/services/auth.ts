// Authentication service: creates accounts (hashing the password) and verifies
// logins. Also stops banned/suspended users from signing in.
import bcrypt from 'bcryptjs';
import { UserModel, UserDoc } from '../models/User';
import { sanitizeInterestTags } from '../data/interests';
import { GUIDELINES_VERSION, BIOMETRIC_CONSENT_VERSION } from '../data/guidelines';
import { isBlocked } from './moderation';
import { sanitizeAgePreference } from './users';

const SALT_ROUNDS = 10;

// Typed error so the login/register routes can map each failure to the right response.
export class AuthError extends Error {
  constructor(
    public code: 'EMAIL_EXISTS' | 'INVALID_CREDENTIALS' | 'ACCOUNT_BLOCKED',
    message: string
  ) {
    super(message);
  }
}

export type RegisterInput = {
  email: string;
  name: string;
  age: number;
  authMethod: 'email' | 'apple' | 'google';
  password: string;
  photoUrl?: string | null;
  photos?: string[];
  bio?: string;
  interestTags?: string[];
  gender?: 'man' | 'woman' | null;
  attraction?: 'men' | 'women' | 'both' | null;
  agePreference?: { min: number; max: number };
  // Version of the community guidelines the user agreed to at sign-up.
  guidelinesVersion?: string;
  // Whether the user opted in to biometric (face) processing.
  biometricConsent?: boolean;
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

  const photos = (input.photos ?? []).filter((p) => typeof p === 'string' && p).slice(0, 4);
  const primaryPhoto = photos[0] ?? input.photoUrl ?? null;

  return UserModel.create({
    email,
    name: input.name,
    age: input.age,
    authMethod: input.authMethod,
    photoUrl: primaryPhoto,
    photos,
    bio: (input.bio ?? '').slice(0, 100),
    interestTags: sanitizeInterestTags(input.interestTags),
    gender: input.gender ?? null,
    attraction: input.attraction ?? null,
    agePreference: sanitizeAgePreference(input.agePreference),
    passwordHash,
    profile: input.profile,
    // The registration route only reaches here once the user has agreed, so we
    // stamp the accepted version + timestamp as their "signature".
    guidelinesAcceptedVersion: input.guidelinesVersion ?? GUIDELINES_VERSION,
    guidelinesAcceptedAt: new Date(),
    // Biometric consent is optional; only stamped when the user opted in.
    biometricConsentVersion: input.biometricConsent ? BIOMETRIC_CONSENT_VERSION : null,
    biometricConsentAt: input.biometricConsent ? new Date() : null,
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

  // Enforcement: a user suspended/banned by the reports pipeline can't sign in.
  const blocked = isBlocked(user);
  if (blocked.blocked) {
    throw new AuthError('ACCOUNT_BLOCKED', blocked.reason ?? 'This account is not available.');
  }

  user.lastActiveAt = new Date();
  await user.save();
  return user;
}
