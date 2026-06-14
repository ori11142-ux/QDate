import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';

const messageEventSchema = new Schema(
  {
    matchId: { type: Schema.Types.ObjectId, ref: 'Match', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    messageLength: { type: Number, required: true, min: 0 },
    responseTimeSeconds: { type: Number, required: true, min: 0 },
    recordedAt: { type: Date, default: () => new Date(), required: true },
  },
  { timestamps: true }
);

messageEventSchema.index({ senderId: 1, recordedAt: -1 });

messageEventSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete (ret as Record<string, unknown>)._id;
  },
});

export type MessageEvent = InferSchemaType<typeof messageEventSchema>;
export type MessageEventDoc = HydratedDocument<MessageEvent>;
export const MessageEventModel = model('MessageEvent', messageEventSchema);
