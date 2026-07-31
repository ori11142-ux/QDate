import { Router } from 'express';
import mongoose, { Types } from 'mongoose';

import {
  createUser,
  findUserById,
  findUserByEmail,
  updateUserProfile,
  adjustIntentScore,
  sanitizeAgePreference,
  ProfileUpdate,
} from '../services/users';
import { INTEREST_OPTIONS, sanitizeInterestTags } from '../data/interests';
import { DATING_INTENTS, COMM_STYLES, GENDERS, ATTRACTIONS } from '../models/User';
import {
  AuthError,
  registerWithPassword,
  verifyLogin,
} from '../services/auth';
import {
  listMessagesForMatch,
  recordMessage,
  markMessagesReadForUser,
  recordConversationMessage,
  listConversationMessages,
} from '../services/messages';
import { recordSwipe, listSwipesForUser } from '../services/swipes';
import {
  getCurrentMatchForUser,
  markRevealed,
  markSkipped,
  markConnected,
  findMatchById,
  skipPairing,
  getPairingConnectState,
} from '../services/matches';
import {
  generateMatchForUser,
  toClientMatch,
} from '../services/matchmaker';
import { computeInsights } from '../services/insights';
import { recordMessageEvent, recordFeedback } from '../services/learning';
import {
  getInterestCalibrationDeck,
  getLookCalibrationDeck,
} from '../services/calibration';
import { UserModel } from '../models/User';
import { guidelinesPayload, GUIDELINES_VERSION } from '../data/guidelines';
import {
  acceptGuidelines,
  submitReport,
  getModerationStanding,
  ModerationError,
} from '../services/moderation';
import { updateUserFaceEmbedding } from '../ml/faceEmbedding';

export const router = Router();
const RATE_WINDOW_MS = 60 * 1000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function parseObjectId(value: string): Types.ObjectId | null {
  if (!Types.ObjectId.isValid(value)) return null;
  return new Types.ObjectId(value);
}

function softRateLimit(bucketKey: string, maxPerMinute: number) {
  return (req: any, res: any, next: any) => {
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const key = `${bucketKey}:${ip}`;
    const now = Date.now();
    const current = rateBuckets.get(key);
    if (!current || current.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
      next();
      return;
    }
    if (current.count >= maxPerMinute) {
      res.status(429).json({ error: 'Too many requests, please slow down' });
      return;
    }
    current.count += 1;
    next();
  };
}

// ─── Health ─────────────────────────────────────────────────────────────────

router.get('/health', (_req, res) => {
  const dbState = mongoose.connection.readyState;
  res.json({
    ok: dbState === 1,
    db: ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState],
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// ─── Auth ───────────────────────────────────────────────────────────────────

router.post('/auth/register', async (req, res) => {
  try {
    const {
      email,
      name,
      age,
      authMethod,
      password,
      photoUrl,
      photos,
      bio,
      interestTags,
      gender,
      attraction,
      agePreference,
      profile,
      guidelinesAccepted,
      guidelinesVersion,
      biometricConsent,
    } = req.body;
    if (!email || !name || !age || !password || !profile) {
      res
        .status(400)
        .json({ error: 'email, name, age, password, and profile are required' });
      return;
    }
    if (!Array.isArray(photos) || photos.filter((p) => typeof p === 'string' && p).length !== 4) {
      res.status(400).json({ error: 'Exactly 4 profile photos are required' });
      return;
    }
    // The user must agree to ("sign") the community guidelines to create an account.
    if (guidelinesAccepted !== true) {
      res.status(400).json({ error: 'You must accept the community guidelines to create an account' });
      return;
    }
    const user = await registerWithPassword({
      email,
      name,
      age,
      authMethod: authMethod ?? 'email',
      password,
      photoUrl,
      photos,
      bio,
      interestTags,
      gender,
      attraction,
      agePreference,
      profile,
      guidelinesVersion: typeof guidelinesVersion === 'string' ? guidelinesVersion : GUIDELINES_VERSION,
      biometricConsent: biometricConsent === true,
    });
    // Compute the pretrained face embedding in the background — ONLY if the user
    // consented to biometric processing. Without consent they're matched by
    // interests and no face signature is created.
    if (biometricConsent === true) {
      void updateUserFaceEmbedding(String(user._id), user.get('photos') as string[]);
    }
    res.status(201).json(user.toJSON());
  } catch (e: any) {
    if (e instanceof AuthError && e.code === 'EMAIL_EXISTS') {
      res.status(409).json({ error: e.message });
      return;
    }
    res.status(400).json({ error: e?.message ?? 'Registration failed' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    const user = await verifyLogin(email, password);
    res.json(user.toJSON());
  } catch (e: any) {
    if (e instanceof AuthError && e.code === 'INVALID_CREDENTIALS') {
      res.status(401).json({ error: e.message });
      return;
    }
    if (e instanceof AuthError && e.code === 'ACCOUNT_BLOCKED') {
      res.status(403).json({ error: e.message });
      return;
    }
    res.status(400).json({ error: e?.message ?? 'Login failed' });
  }
});

// ─── Users ──────────────────────────────────────────────────────────────────

router.post('/users', async (req, res) => {
  try {
    const user = await createUser(req.body);
    res.status(201).json(user.toJSON());
  } catch (e: any) {
    if (e?.code === 11000) {
      res.status(409).json({ error: 'Email already exists' });
      return;
    }
    res.status(400).json({ error: e?.message ?? 'Failed to create user' });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(user.toJSON());
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'Bad request' });
  }
});

router.get('/users/by-email/:email', async (req, res) => {
  const user = await findUserByEmail(req.params.email);
  if (!user) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(user.toJSON());
});

// Update an existing user's profile. Only whitelisted fields are accepted, and
// interestTags are sanitized against the known interest catalog so the matching
// model only ever sees valid axes.
router.patch('/users/:id', async (req, res) => {
  try {
    if (!parseObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid user id' });
      return;
    }
    const body = req.body ?? {};
    const updates: ProfileUpdate = {};

    if (typeof body.name === 'string' && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (typeof body.age === 'number') {
      updates.age = body.age;
    }
    if (body.gender === null || GENDERS.includes(body.gender)) {
      updates.gender = body.gender ?? null;
    }
    if (body.attraction === null || ATTRACTIONS.includes(body.attraction)) {
      updates.attraction = body.attraction ?? null;
    }
    if (body.agePreference && typeof body.agePreference === 'object') {
      updates.agePreference = sanitizeAgePreference(body.agePreference);
    }
    if (typeof body.photoUrl === 'string' || body.photoUrl === null) {
      updates.photoUrl = body.photoUrl ?? null;
    }
    if (Array.isArray(body.photos)) {
      const photos = body.photos.filter((p: unknown) => typeof p === 'string' && p).slice(0, 4);
      updates.photos = photos;
      updates.photoUrl = photos[0] ?? null; // keep the primary avatar in sync
    }
    if (typeof body.bio === 'string') {
      updates.bio = body.bio.slice(0, 100);
    }
    if (body.profile && typeof body.profile === 'object') {
      const p = body.profile;
      if (
        DATING_INTENTS.includes(p.intent) &&
        COMM_STYLES.includes(p.commStyle) &&
        typeof p.sharedIntellectImportance === 'number'
      ) {
        updates.profile = {
          intent: p.intent,
          commStyle: p.commStyle,
          sharedIntellectImportance: p.sharedIntellectImportance,
        };
      }
    }
    if ('interestTags' in body) {
      updates.interestTags = sanitizeInterestTags(body.interestTags);
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    const user = await updateUserProfile(req.params.id, updates);
    if (!user) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    // Photos changed → recompute the face embedding in the background, but only
    // if the user consented to biometric processing.
    if (updates.photos && user.get('biometricConsentAt')) {
      void updateUserFaceEmbedding(String(user._id), updates.photos as string[]);
    }
    res.json(user.toJSON());
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'Failed to update profile' });
  }
});

// Catalog of selectable interests (shared with the mobile client).
router.get('/interests', (_req, res) => {
  res.json(INTEREST_OPTIONS);
});

// ─── Guidelines & moderation ──────────────────────────────────────────────────

// The community rules + report categories the mobile client renders.
router.get('/guidelines', (_req, res) => {
  res.json(guidelinesPayload());
});

// Record that a user has (re-)accepted the guidelines, e.g. after a version bump.
router.post('/guidelines/accept', async (req, res) => {
  try {
    const userId = req.body.userId ?? req.body.user_id;
    if (!parseObjectId(String(userId ?? ''))) {
      res.status(400).json({ error: 'Valid userId is required' });
      return;
    }
    const version = typeof req.body.version === 'string' ? req.body.version : GUIDELINES_VERSION;
    const user = await acceptGuidelines(String(userId), version);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user.toJSON());
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'Failed to accept guidelines' });
  }
});

// File a report against another user. The reported user is derived from the
// match/conversation the report was filed from; the automated rule check then
// runs and the reported user's standing is recomputed.
router.post('/reports', softRateLimit('reports', 20), async (req, res) => {
  try {
    const { reporterId, reportedUserId, matchId, conversationId, category, reason } = req.body;
    if (!reporterId || !category) {
      res.status(400).json({ error: 'reporterId and category are required' });
      return;
    }
    const result = await submitReport({
      reporterId: String(reporterId),
      reportedUserId: reportedUserId ? String(reportedUserId) : undefined,
      matchId: matchId ? String(matchId) : undefined,
      conversationId: conversationId ? String(conversationId) : undefined,
      category: String(category),
      reason: typeof reason === 'string' ? reason : undefined,
    });
    res.status(result.duplicate ? 200 : 201).json({
      ok: true,
      reportId: String(result.report._id),
      status: result.report.status,
      violatesRules: result.report.violatesRules,
      alreadyReported: result.duplicate,
    });
  } catch (e: any) {
    if (e instanceof ModerationError) {
      const status = e.code === 'INVALID_CATEGORY' || e.code === 'SELF_REPORT' ? 400 : 404;
      res.status(status).json({ error: e.message });
      return;
    }
    res.status(400).json({ error: e?.message ?? 'Failed to submit report' });
  }
});

// Debug/admin: a user's current moderation standing.
router.get('/moderation/:userId', async (req, res) => {
  const standing = await getModerationStanding(req.params.userId);
  if (!standing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(standing);
});

// ─── Matches ────────────────────────────────────────────────────────────────

router.get('/matches/current/:userId', async (req, res) => {
  const match = await getCurrentMatchForUser(req.params.userId);
  res.json(match?.toJSON() ?? null);
});

// Generate (or return the existing) Phase 1 daily match for a user.
router.post('/match/daily_generate', softRateLimit('daily_generate', 30), async (req, res) => {
  try {
    const userId = req.body.user_id ?? req.body.userId;
    if (!userId) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }
    const parsedUserId = parseObjectId(String(userId));
    if (!parsedUserId) {
      res.status(400).json({ error: 'Invalid user_id' });
      return;
    }
    const result = await generateMatchForUser(String(parsedUserId), 'phase_1');
    const requester = await UserModel.findById(parsedUserId).select('cooldownUntil');
    const cooldownUntil = requester?.get('cooldownUntil') as Date | null | undefined;
    const cooldownIso =
      cooldownUntil && cooldownUntil.getTime() > Date.now() ? cooldownUntil.toISOString() : null;
    if (!result) {
      // No match right now. Tell the client whether it's a phase-2 cooldown (so
      // it can show the countdown, which then survives reloads) or genuinely no
      // candidates. 200, not 404 — "no match yet" is a normal state, not an error.
      res.json({ match: null, cooldownUntil: cooldownIso });
      return;
    }
    res.json({
      match: toClientMatch(result.match, result.candidate, { cooldownUntil }),
      cooldownUntil: cooldownIso,
    });
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'Failed to generate match' });
  }
});

// Generate (or return the existing) Phase 2 weekly curated match for a user.
router.get('/match/weekly_curated/:userId', softRateLimit('weekly_curated', 20), async (req, res) => {
  try {
    const parsedUserId = parseObjectId(req.params.userId);
    if (!parsedUserId) {
      res.status(400).json({ error: 'Invalid userId' });
      return;
    }
    const result = await generateMatchForUser(String(parsedUserId), 'phase_2');
    if (!result) {
      res.status(404).json({ error: 'No candidates available right now' });
      return;
    }
    const requester = await UserModel.findById(parsedUserId).select('cooldownUntil');
    res.json(
      toClientMatch(result.match, result.candidate, {
        cooldownUntil: requester?.get('cooldownUntil') as Date | null | undefined,
      })
    );
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'Failed to generate match' });
  }
});

// Match state transitions.
router.post('/match/:matchId/reveal', async (req, res) => {
  const match = await markRevealed(req.params.matchId);
  if (!match) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }
  res.json(match.toJSON());
});

router.post('/match/:matchId/skip', async (req, res) => {
  const match = await findMatchById(req.params.matchId);
  if (!match) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }
  const wasOpen = ['pending_reveal', 'active', 'connected'].includes(match.status as string);
  // End both sides of the mutual pairing.
  if (match.conversationId) {
    await skipPairing(match.conversationId);
  } else {
    await markSkipped(match._id);
  }
  // Only a genuine skip of an OPEN match applies the cooldown + intent nudge (a
  // duplicate skip of an already-closed match is a no-op). The person who
  // ACTIVELY skips (this match's owner) gets a cooldown before their next match
  // — phase 1: 1 day, phase 2: 7 days. Only the skipper's id is touched, so the
  // person who was SKIPPED keeps no cooldown and gets a new match right away.
  if (wasOpen) {
    // Phase 2: 7-day cooldown. Phase 1: 1 day (the daily-match rhythm).
    const cooldownMs = match.phase === 'phase_2' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const cooldownUntil = new Date(Date.now() + cooldownMs);
    await UserModel.updateOne({ _id: match.userId }, { cooldownUntil });
    await adjustIntentScore(match.userId, -0.25); // skipping = small negative intent signal
  }
  res.json({ ok: true });
});

router.post('/match/:matchId/connect', async (req, res) => {
  const before = await findMatchById(req.params.matchId);
  const match = await markConnected(req.params.matchId);
  if (!match) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }
  // Engaging (opening the chat) clears any skip cooldown.
  await UserModel.updateOne({ _id: match.userId }, { cooldownUntil: null });
  // Positive intent signal — but only the FIRST time this match is connected;
  // the chat screen re-calls connect on every open, which shouldn't keep
  // inflating the score.
  if (before && before.status !== 'connected') {
    await adjustIntentScore(match.userId, 0.5);
  }
  res.json(match.toJSON());
});

// ─── Messages ───────────────────────────────────────────────────────────────

router.post('/messages', async (req, res) => {
  try {
    const { matchId, senderId, text } = req.body;
    if (!matchId || !senderId || !text) {
      res.status(400).json({ error: 'matchId, senderId, text are required' });
      return;
    }
    const msg = await recordMessage({ matchId, senderId, text });
    res.status(201).json(msg.toJSON());
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'Failed to record message' });
  }
});

router.get('/messages/match/:matchId', async (req, res) => {
  const messages = await listMessagesForMatch(req.params.matchId);
  res.json(messages.map((m) => m.toJSON()));
});

router.post('/messages/match/:matchId/mark-read', async (req, res) => {
  const { readerId } = req.body;
  if (!readerId) {
    res.status(400).json({ error: 'readerId is required' });
    return;
  }
  const count = await markMessagesReadForUser(req.params.matchId, readerId);
  res.json({ marked: count });
});

// ─── Swipes ─────────────────────────────────────────────────────────────────

router.post('/swipes', async (req, res) => {
  try {
    const { userId, cardId, mode, liked, responseTimeMs } = req.body;
    if (!userId || !cardId || !mode || typeof liked !== 'boolean') {
      res.status(400).json({ error: 'userId, cardId, mode, liked are required' });
      return;
    }
    const swipe = await recordSwipe({ userId, cardId, mode, liked, responseTimeMs });
    res.status(201).json(swipe.toJSON());
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'Failed to record swipe' });
  }
});

router.get('/swipes/:userId', async (req, res) => {
  const mode = req.query.mode as 'interests' | 'looks' | undefined;
  const swipes = await listSwipesForUser(req.params.userId, mode);
  res.json(swipes.map((s) => s.toJSON()));
});

// ─── Conversations (shared chat for mutual pairings) ──────────────────────────

router.get('/conversations/:conversationId/messages', async (req, res) => {
  const messages = await listConversationMessages(req.params.conversationId);
  res.json(messages.map((m) => m.toJSON()));
});

// Whether both people have opened (connected to) the chat yet.
router.get('/conversations/:conversationId/status', async (req, res) => {
  const state = await getPairingConnectState(req.params.conversationId);
  res.json(state);
});

// ─── Insights (real per-user statistics) ──────────────────────────────────────

router.get('/insights/:userId', async (req, res) => {
  try {
    const summary = await computeInsights(req.params.userId);
    res.json(summary);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'Failed to compute insights' });
  }
});

// ─── Learning and analytics ───────────────────────────────────────────────────

router.post('/analytics/message_event', softRateLimit('message_event', 120), async (req, res) => {
  try {
    const { matchId, senderId, messageLength, responseTimeSeconds } = req.body;
    if (
      !matchId ||
      !senderId ||
      typeof messageLength !== 'number' ||
      typeof responseTimeSeconds !== 'number'
    ) {
      res.status(400).json({
        error: 'matchId, senderId, messageLength, responseTimeSeconds are required',
      });
      return;
    }
    const parsedMatchId = parseObjectId(matchId);
    const parsedSenderId = parseObjectId(senderId);
    if (!parsedMatchId || !parsedSenderId) {
      res.status(400).json({ error: 'matchId and senderId must be valid ids' });
      return;
    }
    await recordMessageEvent({
      matchId: parsedMatchId,
      senderId: parsedSenderId,
      messageLength,
      responseTimeSeconds,
    });
    res.json({ intent_score_updated: true });
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'Failed to record message event' });
  }
});

router.post('/learning/feedback', softRateLimit('learning_feedback', 60), async (req, res) => {
  try {
    const { matchId, userId, willingnessToMeet, communicationCompatibility } = req.body;
    if (
      !matchId ||
      !userId ||
      typeof willingnessToMeet !== 'number' ||
      typeof communicationCompatibility !== 'number'
    ) {
      res.status(400).json({
        error: 'matchId, userId, willingnessToMeet, communicationCompatibility are required',
      });
      return;
    }
    const parsedMatchId = parseObjectId(matchId);
    const parsedUserId = parseObjectId(userId);
    if (!parsedMatchId || !parsedUserId) {
      res.status(400).json({ error: 'matchId and userId must be valid ids' });
      return;
    }
    await recordFeedback({
      matchId: parsedMatchId,
      userId: parsedUserId,
      willingnessToMeet,
      communicationCompatibility,
    });
    res.json({ accepted: true });
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'Failed to submit feedback' });
  }
});

router.get('/calibration/interests/:userId', async (req, res) => {
  try {
    const cards = await getInterestCalibrationDeck(req.params.userId);
    res.json(cards);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'Failed to load interests deck' });
  }
});

router.get('/calibration/looks/:userId', async (req, res) => {
  try {
    const cards = await getLookCalibrationDeck(req.params.userId);
    res.json(cards);
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'Failed to load looks deck' });
  }
});

router.post('/conversations/:conversationId/messages', async (req, res) => {
  try {
    const { senderId, text } = req.body;
    if (!senderId || !text) {
      res.status(400).json({ error: 'senderId and text are required' });
      return;
    }
    const msg = await recordConversationMessage({
      conversationId: req.params.conversationId,
      senderId,
      text,
    });
    res.status(201).json(msg.toJSON());
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'Failed to send message' });
  }
});
