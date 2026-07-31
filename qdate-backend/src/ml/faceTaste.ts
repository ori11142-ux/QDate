// Phase 2 — per-user VISUAL TASTE learned from looks-swipes over face embeddings.
//
// Model (from the design workflow): a closed-form, confidence- and recency-
// weighted Rocchio direction —
//     faceTasteVector = unit( weightedMean(liked unit faces) − weightedMean(disliked unit faces) )
// This is the max-bias / min-variance choice when N (5–50 swipes) << d (128):
// a 128-weight logistic regressor is underdetermined and overfits; the class-mean
// difference is the heavily-regularized-LR limit (= LDA under identity covariance).
//
// The vector is stored on the User doc and recomputed when the user swipes, so
// score-time is just two O(128) dot products (see faceTasteBlendTerm). Variance
// control lives in the BLEND (beta gates), not in the vector — so with no signal
// the ranker's looks term is byte-identical to Phase 1.

import { Types } from 'mongoose';
import { SwipeModel } from '../models/Swipe';
import { UserModel } from '../models/User';
import { CARD_TAGS_BY_ID } from './calibrationCards';
import { confidenceFromResponseMs } from './features';

const DAY_MS = 24 * 60 * 60 * 1000;
const DIM = 128;

// ── Tunables (calibrated once, never per-user) ────────────────────────────────
export const FACE_TASTE_TEMP = 0.15; // sigmoid temperature for the contrast cosine
const RECENCY_HALF_LIFE_DAYS = 45; // one calibration session ≈ uniform; months decay
const MARGIN_MIN = 1e-3; // below this, taste is contradictory → unavailable
const N_MIN = 3; // minority-class count where trust starts ramping from 0
const N_FULL = 7; // …and reaches 1 (≈ one full looks-calibration deck: ~7 each side)
const MARGIN_FULL = 0.22; // margin where the margin-ramp reaches 1 (real Rocchio
// contrast margins run ~0.2–0.3, so a decisive taste reaches full trust)
export const BETA_MAX = 0.8; // learned face-taste can own up to 80% of the looks term
const GLOBAL_MIN_USERS = 8; // mirrors ranker's outcomesTotal<8 cold-start gate

export type TasteResult = {
  vector: number[]; // unit 128-d, or [] when unavailable
  margin: number; // ‖posCentroid − negCentroid‖, 0 when unavailable
  likes: number; // usable liked samples behind the vector
  dislikes: number; // usable disliked samples
};

const UNAVAILABLE = (likes: number, dislikes: number): TasteResult => ({
  vector: [],
  margin: 0,
  likes,
  dislikes,
});

// ── Pure math (DB-free, unit-testable) ────────────────────────────────────────

/** L2-normalize; null on wrong length, non-finite, or zero norm. */
export function unit(v: number[]): number[] | null {
  if (v.length !== DIM) return null;
  let n = 0;
  for (const x of v) {
    if (!Number.isFinite(x)) return null;
    n += x * x;
  }
  n = Math.sqrt(n);
  if (n === 0) return null;
  return v.map((x) => x / n);
}

/** Dot product, or null unless both are exactly 128-d (same guard as cosineSimilarity). */
export function dotSafe(a: number[], b: number[]): number | null {
  if (a.length !== DIM || b.length !== DIM) return null;
  let d = 0;
  for (let i = 0; i < DIM; i += 1) d += a[i] * b[i];
  return d;
}

/** Map a contrast cosine in [-1,1] to a [0,1] looks sub-score. sigmoid(0)=0.5. */
export function tasteSubScore(x: number): number {
  return 1 / (1 + Math.exp(-x / FACE_TASTE_TEMP));
}

function weightedCentroid(items: { u: number[]; w: number }[]): number[] | null {
  const acc = new Array<number>(DIM).fill(0);
  let wsum = 0;
  for (const it of items) {
    if (!(it.w > 0)) continue;
    for (let i = 0; i < DIM; i += 1) acc[i] += it.w * it.u[i];
    wsum += it.w;
  }
  if (wsum === 0) return null;
  return acc.map((v) => v / wsum);
}

/**
 * Build a taste vector from labeled, weighted face samples. Pure and defensive:
 * normalizes each embedding, drops invalid ones, and returns UNAVAILABLE for any
 * degenerate case (one-sided labels, contradictory swipes).
 */
export function buildTasteFromSamples(
  samples: { emb: number[]; liked: boolean; w: number }[]
): TasteResult {
  const liked: { u: number[]; w: number }[] = [];
  const disliked: { u: number[]; w: number }[] = [];
  for (const s of samples) {
    const u = unit(s.emb);
    if (!u) continue; // wrong length / non-finite / zero-norm
    const w = Number.isFinite(s.w) && s.w > 0 ? s.w : 0;
    (s.liked ? liked : disliked).push({ u, w });
  }
  if (liked.length === 0 || disliked.length === 0) {
    return UNAVAILABLE(liked.length, disliked.length); // one-sided → no contrast
  }
  const posC = weightedCentroid(liked);
  const negC = weightedCentroid(disliked);
  if (!posC || !negC) return UNAVAILABLE(liked.length, disliked.length);

  const raw = posC.map((v, i) => v - negC[i]);
  let margin = 0;
  for (const x of raw) margin += x * x;
  margin = Math.sqrt(margin);
  if (margin < MARGIN_MIN) return UNAVAILABLE(liked.length, disliked.length); // contradictory

  return { vector: raw.map((v) => v / margin), margin, likes: liked.length, dislikes: disliked.length };
}

// ── Score-time blend (pure, runs in the ranker loop) ──────────────────────────

/** One direction: does `tasteVector` like `targetFace`? null if uncomputable. */
function directionScore(tasteVector: number[], targetFace: number[]): number | null {
  if (tasteVector.length !== DIM) return null;
  const f = unit(targetFace);
  if (!f) return null;
  const d = dotSafe(tasteVector, f);
  return d == null ? null : tasteSubScore(d);
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const rampN = (n: number) => clamp01((n - N_MIN) / (N_FULL - N_MIN));
const rampMargin = (m: number) => clamp01(m / MARGIN_FULL);
const dirTrust = (likes: number, dislikes: number, margin: number) =>
  rampN(Math.min(likes, dislikes)) * rampMargin(margin);

export type FaceFeatures = {
  faceEmbedding: number[];
  faceTasteVector: number[];
  faceTasteMargin: number;
  faceTasteLikes: number;
  faceTasteDislikes: number;
};

/**
 * The blend term for the ranker's looks score. Returns the mutual embedding
 * looks sub-score in [0,1] and a blend weight beta in [0, BETA_MAX]. When the
 * signal is absent (either global cold-start or no computable direction) beta is
 * 0, and the caller must reproduce the Phase-1 tag score exactly.
 */
export function faceTasteBlendTerm(
  requester: FaceFeatures,
  candidate: FaceFeatures,
  globalUsableTasteUsers: number
): { mutualEmb: number | null; beta: number } {
  const tR = dirTrust(requester.faceTasteLikes, requester.faceTasteDislikes, requester.faceTasteMargin);
  const tC = dirTrust(candidate.faceTasteLikes, candidate.faceTasteDislikes, candidate.faceTasteMargin);
  // A direction counts only when it is both computable AND its owner's taste is
  // TRUSTWORTHY (trust > 0). Keying on trust rather than mere existence of a
  // vector avoids a discontinuity where a partner who has only just started
  // swiping (a thin, low-trust vector) would drag the blend BELOW what a partner
  // with no vector at all yields — i.e. starting to swipe would hurt them.
  const dAB = tR > 0 ? directionScore(requester.faceTasteVector, candidate.faceEmbedding) : null; // A's taste vs B's face
  const dBA = tC > 0 ? directionScore(candidate.faceTasteVector, requester.faceEmbedding) : null; // B's taste vs A's face

  let mutualEmb: number;
  let trust: number;
  if (dAB != null && dBA != null) {
    mutualEmb = Math.sqrt(dAB * dBA); // geometric mean = mutual-AND
    // Monotonic in each side's trust: a mutual match is never trusted LESS than
    // relying on the stronger single side alone (0.5·max(tR,tC)).
    trust = Math.max(Math.sqrt(tR * tC), 0.5 * tR, 0.5 * tC);
  } else if (dAB != null) {
    mutualEmb = dAB;
    trust = 0.5 * tR; // only one trustworthy side → half trust (can't confirm mutuality)
  } else if (dBA != null) {
    mutualEmb = dBA;
    trust = 0.5 * tC;
  } else {
    return { mutualEmb: null, beta: 0 };
  }

  if (globalUsableTasteUsers < GLOBAL_MIN_USERS) trust = 0; // global cold-start gate
  return { mutualEmb, beta: BETA_MAX * trust };
}

// ── DB-facing (recompute path + score-time global count) ──────────────────────

/** Assemble usable (face, label, weight) samples for a user and build the vector. */
export async function buildFaceTaste(userId: string | Types.ObjectId): Promise<TasteResult> {
  const uid = String(userId);
  const swipes = await SwipeModel.find({ userId, mode: 'looks' })
    .select('cardId liked responseTimeMs swipedAt')
    .lean();

  // Same usable-swipe filter as buildPreferenceVector: real-profile card ids only,
  // never legacy static cards, never a self-swipe.
  const usable = swipes.filter(
    (s) => !CARD_TAGS_BY_ID[s.cardId] && Types.ObjectId.isValid(s.cardId) && s.cardId !== uid
  );
  if (usable.length === 0) return UNAVAILABLE(0, 0);

  // Dedupe to the newest swipe per card so a re-swiped face can't double-count.
  const newest = new Map<string, (typeof usable)[number]>();
  for (const s of usable) {
    const prev = newest.get(s.cardId);
    if (!prev || new Date(s.swipedAt).getTime() > new Date(prev.swipedAt).getTime()) {
      newest.set(s.cardId, s);
    }
  }
  const deduped = [...newest.values()];

  const profiles = await UserModel.find({ _id: { $in: deduped.map((s) => s.cardId) } })
    .select('+faceEmbedding')
    .lean();
  const embById = new Map<string, number[]>();
  for (const p of profiles) {
    const e = (p as unknown as { faceEmbedding?: number[] }).faceEmbedding;
    if (Array.isArray(e) && e.length === DIM) embById.set(String(p._id), e);
  }

  const now = Date.now();
  const samples: { emb: number[]; liked: boolean; w: number }[] = [];
  for (const s of deduped) {
    const emb = embById.get(s.cardId);
    if (!emb) continue; // swiped profile has no face embedding → skip
    const ageDays = Math.max(0, (now - new Date(s.swipedAt).getTime()) / DAY_MS);
    const w = confidenceFromResponseMs(s.responseTimeMs ?? null) * Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
    samples.push({ emb, liked: s.liked, w });
  }

  return buildTasteFromSamples(samples);
}

// Per-user recompute queue. Rapid looks-swipes fire overlapping updateFaceTaste
// calls; without serialization an older recompute (built from a stale swipe
// snapshot) could land its write AFTER a newer one and clobber it — in the
// worst case reverting a just-formed vector to margin 0 and silently disabling
// the model until the next swipe. Chaining per user guarantees the last-queued
// recompute reads the newest swipes and writes last.
const recomputeChains = new Map<string, Promise<unknown>>();

/** Recompute and persist a user's taste. Fire-and-forget safe (swallows errors). */
export function updateFaceTaste(userId: string | Types.ObjectId): Promise<TasteResult | null> {
  const key = String(userId);
  const prev = recomputeChains.get(key) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(() => recomputeFaceTaste(key));
  recomputeChains.set(key, next);
  void next.finally(() => {
    if (recomputeChains.get(key) === next) recomputeChains.delete(key);
  });
  return next;
}

async function recomputeFaceTaste(userId: string): Promise<TasteResult | null> {
  try {
    const t = await buildFaceTaste(userId);
    await UserModel.updateOne(
      { _id: userId },
      {
        faceTasteVector: t.vector,
        faceTasteMargin: t.margin,
        faceTasteLikes: t.likes,
        faceTasteDislikes: t.dislikes,
        faceTasteUpdatedAt: new Date(),
      }
    );
    invalidateGlobalCount();
    console.log(
      `[faceTaste] ${t.vector.length ? `stored (margin ${t.margin.toFixed(3)}, ${t.likes}L/${t.dislikes}D)` : 'unavailable'} for ${userId}`
    );
    return t;
  } catch (e) {
    console.warn('[faceTaste] update failed for', userId, (e as Error).message);
    return null;
  }
}

// Count of users with a usable taste vector, TTL-cached so it's never a per-
// candidate query. Drives the global cold-start gate.
//
// NOTE: this cache and invalidateGlobalCount() are PROCESS-LOCAL. On a single
// backend instance that's exact. If the backend is ever scaled horizontally,
// instances can disagree on the count for up to COUNT_TTL_MS around the
// <8 → ≥8 boundary (one instance may keep the blend off while another turns it
// on). The boundary is crossed ~once in a deployment's life and self-heals
// within the TTL; if that matters, source the count from a shared store.
let cachedCount: number | null = null;
let cachedAt = 0;
const COUNT_TTL_MS = 5 * 60 * 1000;

export function invalidateGlobalCount(): void {
  cachedCount = null;
}

export async function getGlobalUsableTasteUsers(): Promise<number> {
  const now = Date.now();
  if (cachedCount !== null && now - cachedAt < COUNT_TTL_MS) return cachedCount;
  cachedCount = await UserModel.countDocuments({ faceTasteMargin: { $gt: 0 } });
  cachedAt = now;
  return cachedCount;
}
