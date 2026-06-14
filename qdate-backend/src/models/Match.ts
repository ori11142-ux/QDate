import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';
import { PHASES } from './User';

export const MATCH_STATUSES = [
  'pending_reveal', // server-generated, user hasn't tapped Reveal yet
  'active', // user revealed and the 24h/7d window is running
  'expired', // window elapsed without connection
  'skipped', // user explicitly skipped
  'connected', // user tapped "Open Chat"
] as const;

const matchSchema = new Schema(
  {
    // Both users in the pairing. For Phase 1, candidateUser is the one shown to user.
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    candidateUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    phase: { type: String, enum: PHASES, required: true },
    status: { type: String, enum: MATCH_STATUSES, default: 'pending_reveal', index: true },

    expiresAt: { type: Date, required: true },
    revealedAt: { type: Date, default: null },

    // Shared between both sides of a mutual pairing — the key chat messages
    // are stored against. Both the A→B and B→A match docs carry the same value.
    conversationId: { type: String, default: null, index: true },

    // Phase 2 only — populated by the curation pipeline.
    isIntentionalPairing: { type: Boolean, default: false },

    // For Phase 1 only — useful for analytics on day-N matching.
    dayInLearningPeriod: { type: Number, default: null, min: 1, max: 14 },
  },
  { timestamps: true }
);

// Compound index for "give me this user's currently-active match" queries.
matchSchema.index({ userId: 1, status: 1 });

matchSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete (ret as Record<string, unknown>)._id;
  },
});

export type Match = InferSchemaType<typeof matchSchema>;
export type MatchDoc = HydratedDocument<Match>;
export const MatchModel = model('Match', matchSchema);
