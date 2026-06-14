import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';

const feedbackSchema = new Schema(
  {
    matchId: { type: Schema.Types.ObjectId, ref: 'Match', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    willingnessToMeet: { type: Number, required: true, min: 1, max: 5 },
    communicationCompatibility: { type: Number, required: true, min: 1, max: 5 },
  },
  { timestamps: true }
);

feedbackSchema.index({ userId: 1, createdAt: -1 });

feedbackSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete (ret as Record<string, unknown>)._id;
  },
});

export type Feedback = InferSchemaType<typeof feedbackSchema>;
export type FeedbackDoc = HydratedDocument<Feedback>;
export const FeedbackModel = model('Feedback', feedbackSchema);
