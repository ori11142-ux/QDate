import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';
import { REPORT_CATEGORY_IDS } from '../data/guidelines';

/**
 * A report filed by one user against another. When a report is created the
 * moderation service evaluates its category against the community rules
 * (see data/guidelines.ts), stamps the result onto the doc, and recomputes the
 * reported user's standing. Reports are never deleted — they are the audit
 * trail behind every enforcement action.
 */
export const REPORT_STATUSES = [
  'pending', // needs manual review (category 'other', or no rule matched)
  'auto_flagged', // automatically determined to violate a rule
  'reviewed', // a human reviewed it
  'dismissed', // reviewed and found not to violate the rules
] as const;

export const REPORT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

const reportSchema = new Schema(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportedUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Optional context the report was filed from.
    conversationId: { type: String, default: null },
    matchId: { type: Schema.Types.ObjectId, ref: 'Match', default: null },

    category: { type: String, enum: REPORT_CATEGORY_IDS, required: true },
    reason: { type: String, default: '', maxlength: 1000, trim: true },

    // Result of the automated rule check, stamped at creation time.
    violatesRules: { type: Boolean, default: false, index: true },
    ruleIds: { type: [String], default: [] },
    severity: { type: String, enum: REPORT_SEVERITIES, default: 'low' },

    status: { type: String, enum: REPORT_STATUSES, default: 'pending', index: true },
  },
  { timestamps: true }
);

// "Give me all reports against user X" — the enforcement aggregation.
reportSchema.index({ reportedUserId: 1, violatesRules: 1 });
// Dedupe guard: one open report per (reporter, reported) pair.
reportSchema.index({ reporterId: 1, reportedUserId: 1, status: 1 });

reportSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete (ret as Record<string, unknown>)._id;
  },
});

export type Report = InferSchemaType<typeof reportSchema>;
export type ReportDoc = HydratedDocument<Report>;
export const ReportModel = model('Report', reportSchema);
