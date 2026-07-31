// Community guidelines mirrored from the backend (qdate-backend/src/data/guidelines.ts).
// Kept local so the rules render instantly offline during onboarding. Keep
// GUIDELINES_VERSION in sync with the backend so the "signature" version matches.

export const GUIDELINES_VERSION = '1.0';

// Explicit, optional consent to biometric (face) processing — mirrored from the
// backend (qdate-backend/src/data/guidelines.ts). Keep the version in sync.
export const BIOMETRIC_CONSENT_VERSION = '1.0';

export const BIOMETRIC_CONSENT = {
  version: BIOMETRIC_CONSENT_VERSION,
  title: 'Face-based matching',
  summary: 'Let QDate analyze your photos to learn your visual taste and improve your matches.',
  points: [
    'We create a numeric "face signature" from your primary photo. It stays on our servers, is used only to match you, and is never shown to other members.',
    'This is biometric data, so we ask for your explicit consent. It is optional — if you decline, you\'ll still be matched using your interests.',
    'We never sell it or use it for anything other than matching.',
    'You can withdraw consent and have this data deleted at any time — just ask.',
  ],
};

export interface CommunityRule {
  id: string;
  title: string;
  body: string;
}

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

export interface ReportCategory {
  id: string;
  label: string;
}

export const REPORT_CATEGORIES: ReportCategory[] = [
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'hate_speech', label: 'Hate speech' },
  { id: 'inappropriate', label: 'Inappropriate or explicit content' },
  { id: 'fake_profile', label: 'Fake profile or impersonation' },
  { id: 'spam_scam', label: 'Spam or scam' },
  { id: 'threat_violence', label: 'Threats or violence' },
  { id: 'underage', label: 'Underage user' },
  { id: 'privacy', label: 'Shared private information' },
  { id: 'other', label: 'Something else' },
];
