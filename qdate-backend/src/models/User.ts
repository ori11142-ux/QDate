import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';

export const DATING_INTENTS = ['long_term', 'casual', 'explore', 'friendship'] as const;
export const COMM_STYLES = ['texting_first', 'voice_early', 'meet_in_person'] as const;
export const AUTH_METHODS = ['email', 'apple'] as const;
export const PHASES = ['phase_1', 'phase_2'] as const;
export const GENDERS = ['man', 'woman'] as const;
export const ATTRACTIONS = ['men', 'women', 'both'] as const;

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

    // Profile picture. Stores either an external URL or a data URI
    // ("data:image/jpeg;base64,..."). Null until the user adds one.
    photoUrl: { type: String, default: null },

    passwordHash: { type: String, default: null, select: false },

    profile: {
      intent: { type: String, enum: DATING_INTENTS, required: true },
      sharedIntellectImportance: { type: Number, min: 1, max: 5, required: true },
      commStyle: { type: String, enum: COMM_STYLES, required: true },
    },

    currentPhase: { type: String, enum: PHASES, default: 'phase_1' },
    intentScore: { type: Number, min: 0, max: 10, default: 5 },
    lastActiveAt: { type: Date, default: () => new Date() },
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
  },
});

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User>;
export const UserModel = model('User', userSchema);
