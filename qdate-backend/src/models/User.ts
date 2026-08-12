// Mongoose model for a User account: profile, dating preferences, matching phase,
// moderation standing, and the ML face-taste vectors. The central document the
// rest of the app is built around.
import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';

export const DATING_INTENTS = ['long_term', 'casual', 'explore', 'friendship'] as const;
export const COMM_STYLES = ['texting_first', 'voice_early', 'meet_in_person'] as const;
export const AUTH_METHODS = ['email', 'apple', 'google'] as const;
export const PHASES = ['phase_1', 'phase_2'] as const;
export const GENDERS = ['man', 'woman'] as const;
export const ATTRACTIONS = ['men', 'women', 'both'] as const;
export const MODERATION_STATUSES = ['active', 'warned', 'suspended', 'banned'] as const;

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 18, max: 99 },
    authMethod: { type: String, enum: AUTH_METHODS, required: true },

    // The user's own gender, and who they're interested in.
    gender: { type: String, enum: GENDERS, default: null },
    attraction: { type: String, enum: ATTRACTIONS, default: null },

    // Preferred age range for candidates. Enforced mutually by the matcher (like
    // gender): each person must fall inside the other's range. Default [18, 99]
    // = no restriction.
    agePreference: {
      min: { type: Number, default: 18, min: 18, max: 99 },
      max: { type: Number, default: 99, min: 18, max: 99 },
    },

    // Primary profile picture (mirrors photos[0]). Kept for the many avatar
    // call-sites that expect a single URL. External URL or data URI.
    photoUrl: { type: String, default: null },

    // Up to 4 profile pictures. photos[0] is the primary and is mirrored into
    // photoUrl on create/update.
    photos: { type: [String], default: [] },

    // Short free-text bio, capped at 100 characters.
    bio: { type: String, default: '', maxlength: 100, trim: true },

    passwordHash: { type: String, default: null, select: false },

    profile: {
      intent: { type: String, enum: DATING_INTENTS, required: true },
      sharedIntellectImportance: { type: Number, min: 1, max: 5, required: true },
      commStyle: { type: String, enum: COMM_STYLES, required: true },
    },

    currentPhase: { type: String, enum: PHASES, default: 'phase_1' },
    intentScore: { type: Number, min: 0, max: 10, default: 5 },
    lastActiveAt: { type: Date, default: () => new Date() },
    cooldownUntil: { type: Date, default: null },

    // Community guidelines the user agreed to ("signed") at sign-up.
    guidelinesAcceptedVersion: { type: String, default: null },
    guidelinesAcceptedAt: { type: Date, default: null },

    // Explicit, OPTIONAL consent to biometric (face) processing. Null when the
    // user has not consented — in which case no faceEmbedding is computed and
    // they are matched by interests only. Withdrawing consent should clear these
    // and delete faceEmbedding/faceTasteVector.
    biometricConsentVersion: { type: String, default: null },
    biometricConsentAt: { type: Date, default: null },

    // Moderation standing, driven by reports (see services/moderation.ts).
    // strikeCount is a weighted, distinct-reporter score, not a raw count.
    moderationStatus: { type: String, enum: MODERATION_STATUSES, default: 'active', index: true },
    strikeCount: { type: Number, default: 0, min: 0 },
    suspendedUntil: { type: Date, default: null },

    // Optional structured tags used by the matching model.
    interestTags: { type: [String], default: [] },
    appearanceTags: { type: [String], default: [] },

    // Pretrained 128-d face embedding derived from the user's primary photo
    // (see ml/faceEmbedding.ts). Biometric data — never sent to clients (see the
    // toJSON transform below). Empty until computed; empty when no face is found.
    faceEmbedding: { type: [Number], default: [], select: false },

    // Phase 2 — learned visual taste (see ml/faceTaste.ts). A unit 128-d Rocchio
    // direction = weightedMean(liked faces) − weightedMean(disliked faces),
    // recomputed when the user records a 'looks' swipe. Derived from OTHER users'
    // faces, so also biometric-adjacent → select:false + stripped from toJSON.
    // Empty until there is both a liked and a disliked usable looks-swipe.
    faceTasteVector: { type: [Number], default: [], select: false },
    // ‖posCentroid − negCentroid‖ (0..2): taste separation/confidence. Drives the
    // blend ramp and the global cold-start count ({ faceTasteMargin: { $gt: 0 } }).
    // These are derived behavioral data (how much/how decisively a user swiped),
    // so they're select:false — never returned by GET /users/:id, which has no
    // auth. The scoring path loads them explicitly via +select in matchmaker.ts,
    // and the cold-start count uses a server-side countDocuments (works either way).
    faceTasteMargin: { type: Number, default: 0, select: false },
    // Counts of usable liked/disliked looks-swipes behind the vector (min drives the trust ramp).
    faceTasteLikes: { type: Number, default: 0, select: false },
    faceTasteDislikes: { type: Number, default: 0, select: false },
    faceTasteUpdatedAt: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    const r = ret as Record<string, unknown>;
    delete r._id;
    delete r.passwordHash;
    delete r.faceEmbedding; // biometric — never expose over the API
    delete r.faceTasteVector; // biometric-derived — never expose over the API
  },
});

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User>;
export const UserModel = model('User', userSchema);
