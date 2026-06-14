// Shape contracts shared with backend. Keep in sync with the API.

export type DatingIntent = 'long_term' | 'casual' | 'explore' | 'friendship';
export type CommStyle = 'texting_first' | 'voice_early' | 'meet_in_person';
export type Gender = 'man' | 'woman';
export type Attraction = 'men' | 'women' | 'both';
export type Phase = 'phase_1' | 'phase_2';
export type CalibrationMode = 'interests' | 'looks';

export interface IntentProfile {
  intent: DatingIntent;
  sharedIntellectImportance: number; // 1..5
  commStyle: CommStyle;
}

export interface Match {
  matchId: string;
  conversationId?: string;
  status?: 'pending_reveal' | 'active' | 'connected' | 'skipped' | 'expired';
  candidateName: string;
  candidateAge: number;
  candidateBio: string;
  candidatePhotoUrl?: string;
  expiresAt: string;
  dayInLearningPeriod?: number;
  totalLearningDays?: number;
  isIntentionalPairing?: boolean;
  cooldownActive?: boolean;
}

export interface MessageEvent {
  matchId: string;
  senderId: string; // MongoDB user id
  messageLength: number;
  responseTimeSeconds: number;
}

export interface FeedbackPayload {
  matchId: string;
  userId: string; // MongoDB user id
  willingnessToMeet: number;
  communicationCompatibility: number;
}

export interface InsightsSummary {
  intentScore: number;
  avgReplyTimeHours: number | null;
  messagesSentLast7Days: number;
  totalMessages: number;
  matchOutcomes: {
    connected: number;
    skipped: number;
    expired: number;
    pendingOrActive: number;
  };
  calibration: { interests: number | null; looks: number | null };
  reflections: { matchId: string; name: string; age: number; reason: string }[];
}

export interface ChatMessage {
  id: string;
  matchId: string;
  text: string;
  sentAt: string;
  fromMe: boolean;
}

export interface InterestCard {
  id: string;
  icon: string;
  label: string;
  description: string;
  tags?: string[];
}

export interface LookCard {
  id: string;
  photoUrl: string;
  name: string;
  age: number;
  tags?: string[];
}

export interface CalibrationSwipe {
  cardId: string;
  mode: CalibrationMode;
  liked: boolean;
  swipedAt: string;
}
