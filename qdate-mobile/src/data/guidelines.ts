// Community guidelines mirrored from the backend (qdate-backend/src/data/guidelines.ts).
// Kept local so the rules render instantly offline during onboarding. Keep
// GUIDELINES_VERSION in sync with the backend so the "signature" version matches.

export const GUIDELINES_VERSION = '1.0';

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
