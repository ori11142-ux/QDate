// Community guidelines — the single source of truth for:
//   1. the rules every user "signs" (agrees to) at sign-up, and
//   2. the report categories, each of which maps to one or more rules plus a
//      severity used by the automated moderation check.
//
// Bump GUIDELINES_VERSION whenever the RULES text changes materially. A user's
// stored `guidelinesAcceptedVersion` can then be compared to re-prompt them.

export const GUIDELINES_VERSION = '1.0';

export interface CommunityRule {
  id: string;
  title: string;
  body: string;
}

/** The rules the user reads and agrees to. Displayed on the client verbatim. */
export const COMMUNITY_RULES: CommunityRule[] = [
  {
    id: 'respect',
    title: 'Treat people with respect',
    body: 'No harassment, bullying, hate speech, or demeaning language toward anyone.',
  },
  {
    id: 'authentic',
    title: 'Be your authentic self',
    body: 'Use real, recent photos of yourself and accurate information. No impersonation or catfishing.',
  },
  {
    id: 'no_explicit',
    title: 'No unwanted or explicit content',
    body: 'Never send sexual, graphic, or harassing content to someone who has not welcomed it.',
  },
  {
    id: 'safety',
    title: 'Keep the community safe',
    body: 'No threats, violence, or encouragement of self-harm or illegal activity.',
  },
  {
    id: 'no_spam',
    title: 'No spam or scams',
    body: 'No advertising, solicitation, phishing, or requests for money.',
  },
  {
    id: 'adults_only',
    title: 'Adults only (18+)',
    body: 'QDate is strictly for adults. Never misrepresent your age or interact with minors.',
  },
  {
    id: 'privacy',
    title: "Protect people's privacy",
    body: "Never share someone's private information or photos without their consent.",
  },
];

export type Severity = 'low' | 'medium' | 'high' | 'critical';

/** How much each severity contributes to a user's weighted strike score. */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 5,
};

export interface ReportCategory {
  id: string;
  label: string;
  /** Rules (by id) this category violates. Empty => needs manual review. */
  ruleIds: string[];
  severity: Severity;
}

/** The categories a reporter chooses from. Order = display order on the client. */
export const REPORT_CATEGORIES: ReportCategory[] = [
  { id: 'harassment', label: 'Harassment or bullying', ruleIds: ['respect', 'no_explicit'], severity: 'high' },
  { id: 'hate_speech', label: 'Hate speech', ruleIds: ['respect'], severity: 'high' },
  { id: 'inappropriate', label: 'Inappropriate or explicit content', ruleIds: ['no_explicit'], severity: 'high' },
  { id: 'fake_profile', label: 'Fake profile or impersonation', ruleIds: ['authentic'], severity: 'medium' },
  { id: 'spam_scam', label: 'Spam or scam', ruleIds: ['no_spam'], severity: 'medium' },
  { id: 'threat_violence', label: 'Threats or violence', ruleIds: ['safety'], severity: 'critical' },
  { id: 'underage', label: 'Underage user', ruleIds: ['adults_only'], severity: 'critical' },
  { id: 'privacy', label: 'Shared private information', ruleIds: ['privacy'], severity: 'medium' },
  { id: 'other', label: 'Something else', ruleIds: [], severity: 'low' },
];

export const REPORT_CATEGORY_IDS = REPORT_CATEGORIES.map((c) => c.id);

export interface RuleEvaluation {
  category: ReportCategory;
  /** True when the category maps to at least one concrete rule. */
  violatesRules: boolean;
  ruleIds: string[];
  severity: Severity;
  weight: number;
}

/**
 * The automated rule check. Given a report category, determine which community
 * rules it breaks and how severe it is. `other` maps to no rule, so it does not
 * auto-count against the user — it is flagged for manual review instead.
 */
export function evaluateReportCategory(categoryId: string): RuleEvaluation | null {
  const category = REPORT_CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return null;
  return {
    category,
    violatesRules: category.ruleIds.length > 0,
    ruleIds: category.ruleIds,
    severity: category.severity,
    weight: SEVERITY_WEIGHT[category.severity],
  };
}

/** Payload shape returned by GET /api/guidelines for the mobile client. */
export function guidelinesPayload() {
  return {
    version: GUIDELINES_VERSION,
    rules: COMMUNITY_RULES,
    reportCategories: REPORT_CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
  };
}
