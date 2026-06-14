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
// Your phone CANNOT reach "localhost" — that's the phone's own loopback, not
// your computer. We auto-detect your computer's LAN IP from Expo's dev server
// (it serves on that IP at port 8081; the backend is the same IP at port 5000).
//
// If auto-detection fails (some emulators, unusual networks), set MANUAL_HOST
// to your computer's IP. Find it on Windows with `ipconfig` → IPv4 Address.
const MANUAL_HOST = ''; // e.g. 'http://192.168.1.42:5000'
const BACKEND_PORT = 5000;

function resolveBackendHost(): string {
  if (MANUAL_HOST) return MANUAL_HOST;

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
  authMethod: 'email' | 'apple';
  photoUrl: string | null;
  gender: 'man' | 'woman' | null;
  attraction: 'men' | 'women' | 'both' | null;
  profile: {
    intent: 'long_term' | 'casual' | 'explore' | 'friendship';
    sharedIntellectImportance: number;
    commStyle: 'texting_first' | 'voice_early' | 'meet_in_person';
  };
  currentPhase: 'phase_1' | 'phase_2';
  intentScore: number;
  createdAt: string;
}

export type RegisterPayload = {
  email: string;
  name: string;
  age: number;
  authMethod: 'email' | 'apple';
  password: string;
  photoUrl?: string | null;
  gender?: 'man' | 'woman' | null;
  attraction?: 'men' | 'women' | 'both' | null;
  profile: BackendUser['profile'];
};

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

  // ── Matches / insights / calibration — mockable for now ───────────────────
  // ── Matches — REAL backend (heuristic matcher) ────────────────────────────
  async generateDailyMatch(userId: string): Promise<Match> {
    return request<Match>('/match/daily_generate', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  },

  async getWeeklyCuratedMatch(userId: string): Promise<Match> {
    return request<Match>(`/match/weekly_curated/${userId}`);
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
