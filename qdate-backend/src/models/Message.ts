import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';

/**
 * Every message ever sent is kept here. The ML model trains on:
 *   - Text content (sentiment, topics, engagement style)
 *   - responseTimeSeconds (how long the user took to reply)
 *   - messageLength (verbose vs terse style)
 *   - sentAt + readAt (read latency)
 *
 * Do NOT delete messages even after a match expires. This is the corpus.
 */
const messageSchema = new Schema(
  {
    matchId: { type: Schema.Types.ObjectId, ref: 'Match', required: false, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Shared conversation key (same for both sides of a mutual pairing).
    // Chat reads/writes are keyed off this so both people see one thread.
    conversationId: { type: String, default: null, index: true },

    text: { type: String, required: true, maxlength: 5000 },

    // Stored explicitly even though it's derivable from text — saves
    // aggregation cost when computing average message length across millions of rows.
    messageLength: { type: Number, required: true, min: 0 },

    // Seconds between the previous message (from the OTHER party) and this send.
    // 0 = sender initiated. Null if sender is initiating a fresh conversation.
    responseTimeSeconds: { type: Number, default: null, min: 0 },

    sentAt: { type: Date, default: () => new Date(), required: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Conversation retrieval: get all messages for a match, ordered.
messageSchema.index({ matchId: 1, sentAt: 1 });

// User-level aggregations (e.g. avg reply latency for user X):
messageSchema.index({ senderId: 1, sentAt: -1 });

messageSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete (ret as Record<string, unknown>)._id;
  },
});

export type Message = InferSchemaType<typeof messageSchema>;
export type MessageDoc = HydratedDocument<Message>;
export const MessageModel = model('Message', messageSchema);
