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
  // The phase this match belongs to — the client syncs its local phase to this
  // so an aged (phase-2) user is never stranded by a stale local phase.
  phase?: Phase;
  candidateName: string;
  candidateAge: number;
  candidateBio: string;
  candidatePhotoUrl?: string;
  candidatePhotos?: string[];
  candidateInterests?: string[];
  candidateIntent?: DatingIntent;
  candidateCommStyle?: CommStyle;
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
  activity: {
    interestSwipes: number;
    lookSwipes: number;
    matches: number;
    connections: number;
    messagesSent: number;
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

// Calibration cards are now built from real profiles. `bio` is the real
// profile's bio (interests mode); the legacy icon/label/description fields are
// kept optional for backward compatibility with any static cards.
export interface InterestCard {
  id: string;
  bio?: string;
  icon?: string;
  label?: string;
  description?: string;
  tags?: string[];
}

export interface LookCard {
  id: string;
  photoUrl: string;
  photos?: string[];
  name?: string;
  age?: number;
  tags?: string[];
}

export interface CalibrationSwipe {
  cardId: string;
  mode: CalibrationMode;
  liked: boolean;
  swipedAt: string;
}
