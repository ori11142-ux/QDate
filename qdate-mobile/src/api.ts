// API client. Auth calls always hit the real backend; match/insights/swipe
// calls fall back to mocks until those endpoints are live.

import Constants from 'expo-constants';
import {
  CalibrationSwipe,
  FeedbackPayload,
  InsightsSummary,
  InterestCard,
  LookCard,
  Match,
  MessageEvent,
} from './types';
import {
  mockInterestDeck,
  mockLookDeck,
} from './mocks';

// ─── Backend host resolution ──────────────────────────────────────────────
// PRODUCTION / standalone builds have no Expo dev server, so they read a
// configured public URL: EXPO_PUBLIC_API_URL (set per-build in eas.json) or
// expo.extra.apiUrl (app.json). This is REQUIRED for a real installed app.
//
// DEV (Expo Go): your phone CANNOT reach "localhost" — that's the phone's own
// loopback. We auto-detect your computer's LAN IP from Expo's dev server (port
// 8081; the backend is the same IP at port 5000). Set MANUAL_HOST to override
// (find your IP on Windows with `ipconfig` → IPv4 Address).
const MANUAL_HOST = ''; // e.g. 'http://192.168.1.42:5000'
const BACKEND_PORT = 5000;

function resolveBackendHost(): string {
  if (MANUAL_HOST) return MANUAL_HOST;

  // A configured public API URL (trailing slashes trimmed).
  const configured = (
    process.env.EXPO_PUBLIC_API_URL ||
    (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ||
    ''
  ).replace(/\/+$/, '');

  // Standalone/production build: no dev server to sniff — the configured URL is
  // the only way to reach the backend.
  if (!__DEV__) {
    if (configured) return configured;
    console.warn(
      '[api] No backend URL configured for this build. Set EXPO_PUBLIC_API_URL ' +
        '(eas.json) or expo.extra.apiUrl (app.json) — network requests will fail.'
    );
    return `http://localhost:${BACKEND_PORT}`;
  }

  // Dev (Expo Go): an explicit configured URL wins; else auto-detect the LAN IP.
  if (configured) return configured;
  const hostUri =
    Constants.expoConfig?.hostUri ??
    // Fallbacks for older Expo runtimes
    // @ts-ignore
    (Constants.manifest?.debuggerHost as string | undefined) ??
    // @ts-ignore
    (Constants.expoGoConfig?.debuggerHost as string | undefined);

  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:${BACKEND_PORT}`;
  }
  return `http://localhost:${BACKEND_PORT}`;
}

const API_BASE = `${resolveBackendHost()}/api`;

// Backend now supports match/insights/learning/calibration endpoints.
const USE_MOCK_API = false;

// Shared fetch helper: adds the base URL + JSON headers and turns HTTP/network
// failures into friendly Error messages the screens can show.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch (networkErr) {
    throw new Error(
      `Can't reach the server at ${API_BASE}. Is the backend running, and are you on the same WiFi?`
    );
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // non-JSON error body
    }
    throw new Error(message);
  }
  return res.json();
}

// Shape the backend returns for a user.
export interface BackendUser {
  id: string;
  name: string;
  email: string;
  age: number;
  authMethod: 'email' | 'apple' | 'google';
  photoUrl: string | null;
  photos: string[];
  bio: string;
  gender: 'man' | 'woman' | null;
  attraction: 'men' | 'women' | 'both' | null;
  agePreference: { min: number; max: number };
  profile: {
    intent: 'long_term' | 'casual' | 'explore' | 'friendship';
    sharedIntellectImportance: number;
    commStyle: 'texting_first' | 'voice_early' | 'meet_in_person';
  };
  interestTags: string[];
  appearanceTags: string[];
  currentPhase: 'phase_1' | 'phase_2';
  intentScore: number;
  createdAt: string;
}

// Fields the client is allowed to edit on an existing profile.
export type ProfileUpdatePayload = {
  name?: string;
  age?: number;
  gender?: 'man' | 'woman' | null;
  attraction?: 'men' | 'women' | 'both' | null;
  agePreference?: { min: number; max: number };
  photos?: string[];
  bio?: string;
  profile?: BackendUser['profile'];
  interestTags?: string[];
};

export type RegisterPayload = {
  email: string;
  name: string;
  age: number;
  authMethod: 'email' | 'apple' | 'google';
  password: string;
  photos: string[];
  bio?: string;
  interestTags?: string[];
  gender?: 'man' | 'woman' | null;
  attraction?: 'men' | 'women' | 'both' | null;
  agePreference: { min: number; max: number };
  profile: BackendUser['profile'];
  // The user "signs" the community guidelines during onboarding.
  guidelinesAccepted: boolean;
  guidelinesVersion: string;
  // Optional opt-in to biometric (face) processing.
  biometricConsent: boolean;
};

export type ReportPayload = {
  reporterId: string;
  category: string;
  reason?: string;
  // At least one of these so the backend can identify who is being reported.
  reportedUserId?: string;
  matchId?: string;
  conversationId?: string;
};

export type ReportResult = {
  ok: boolean;
  reportId: string;
  status: string;
  violatesRules: boolean;
  alreadyReported: boolean;
};

// The app's API surface: every backend call the mobile app makes lives here.
export const api = {
  // ── Auth — ALWAYS hits the real backend ──────────────────────────────────
  async register(payload: RegisterPayload): Promise<BackendUser> {
    return request<BackendUser>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async login(email: string, password: string): Promise<BackendUser> {
    return request<BackendUser>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async updateProfile(userId: string, updates: ProfileUpdatePayload): Promise<BackendUser> {
    return request<BackendUser>(`/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  // ── Reporting / moderation ────────────────────────────────────────────────
  async reportUser(payload: ReportPayload): Promise<ReportResult> {
    return request<ReportResult>('/reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // ── Matches / insights / calibration — mockable for now ───────────────────
  // ── Matches — REAL backend (heuristic matcher) ────────────────────────────
  // Returns the match if one is available, or { match: null, cooldownUntil } —
  // where cooldownUntil is set when the user is in a phase-2 skip cooldown, so
  // the client can show a countdown that survives reloads.
  async generateDailyMatch(
    userId: string
  ): Promise<{ match: Match | null; cooldownUntil: string | null }> {
    return request<{ match: Match | null; cooldownUntil: string | null }>('/match/daily_generate', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  },

  async getWeeklyCuratedMatch(userId: string): Promise<Match> {
    return request<Match>(`/match/weekly_curated/${userId}`);
  },

  // Lightweight poll: the user's currently-open match (pending/active), or null
  // if their pairing ended (e.g. the other person skipped them).
  async getCurrentMatch(userId: string): Promise<{ id: string; status: string } | null> {
    return request<{ id: string; status: string } | null>(`/matches/current/${userId}`);
  },

  async revealMatch(matchId: string): Promise<void> {
    await request(`/match/${matchId}/reveal`, { method: 'POST' });
  },

  async skipMatch(matchId: string): Promise<void> {
    await request(`/match/${matchId}/skip`, { method: 'POST' });
  },

  async connectMatch(matchId: string): Promise<void> {
    await request(`/match/${matchId}/connect`, { method: 'POST' });
  },

  // ── Conversations (shared real chat) ──────────────────────────────────────
  async getConversationStatus(
    conversationId: string
  ): Promise<{ total: number; connected: number; bothConnected: boolean }> {
    return request(`/conversations/${conversationId}/status`);
  },

  async getConversationMessages(conversationId: string): Promise<
    {
      id: string;
      conversationId: string;
      senderId: string;
      text: string;
      messageLength: number;
      responseTimeSeconds: number | null;
      sentAt: string;
    }[]
  > {
    return request(`/conversations/${conversationId}/messages`);
  },

  async sendConversationMessage(
    conversationId: string,
    senderId: string,
    text: string
  ): Promise<{ id: string; sentAt: string }> {
    return request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ senderId, text }),
    });
  },

  async recordMessageEvent(event: MessageEvent): Promise<{ intent_score_updated: boolean }> {
    if (USE_MOCK_API) return { intent_score_updated: true };
    return request('/analytics/message_event', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  },

  async submitFeedback(payload: FeedbackPayload): Promise<{ accepted: boolean }> {
    if (USE_MOCK_API) return { accepted: true };
    return request('/learning/feedback', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getInsights(userId: string): Promise<InsightsSummary> {
    return request<InsightsSummary>(`/insights/${userId}`);
  },

  async getInterestDeck(userId: string): Promise<InterestCard[]> {
    if (USE_MOCK_API) return mockInterestDeck;
    return request<InterestCard[]>(`/calibration/interests/${userId}`);
  },

  async getLookDeck(userId: string): Promise<LookCard[]> {
    if (USE_MOCK_API) return mockLookDeck;
    return request<LookCard[]>(`/calibration/looks/${userId}`);
  },

  async submitCalibrationSwipe(
    userId: string,
    swipe: CalibrationSwipe
  ): Promise<{ ok: boolean }> {
    if (USE_MOCK_API) return { ok: true };
    return request('/swipes', {
      method: 'POST',
      body: JSON.stringify({ userId, ...swipe }),
    });
  },
};
