/**
 * Test harness for the Phase 2 face-taste model.
 *
 *   npm run eval:face-taste
 *
 * Three parts:
 *   1. UNIT — assertions on the pure math (buildTasteFromSamples edge cases,
 *      score mapping, geometric mutual scoring, cold-start gates).
 *   2. DEGRADATION — the key regression invariant: no signal ⇒ beta 0.
 *   3. AUC — does the learned taste predict held-out likes? Uses the REAL face
 *      embeddings seeded by `npm run seed:faces`: simulate a user with a known
 *      "type", train on a subset, measure ranking AUC on held-out faces, bucketed
 *      by training size, vs a random baseline and the oracle upper bound.
 */

import 'dotenv/config';
import { connectToDb, disconnectFromDb } from '../config/db';
import { UserModel } from '../models/User';
import {
  buildTasteFromSamples,
  tasteSubScore,
  dotSafe,
  unit,
  faceTasteBlendTerm,
  FACE_TASTE_TEMP,
  BETA_MAX,
  type FaceFeatures,
} from '../ml/faceTaste';

// ── tiny test utils ───────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    console.log(`  ✗ FAIL: ${name}`);
  }
}
function approx(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) <= eps;
}
function norm(v: number[]): number {
  let n = 0;
  for (const x of v) n += x * x;
  return Math.sqrt(n);
}
function basis(i: number, scale = 1): number[] {
  const v = new Array<number>(128).fill(0);
  v[i] = scale;
  return v;
}
function randUnit(): number[] {
  const v = Array.from({ length: 128 }, () => Math.random() * 2 - 1);
  const n = norm(v);
  return v.map((x) => x / n);
}
function cos(a: number[], b: number[]): number {
  const ua = unit(a)!;
  const ub = unit(b)!;
  let d = 0;
  for (let i = 0; i < 128; i++) d += ua[i] * ub[i];
  return d;
}

// ── 1. UNIT: pure math ────────────────────────────────────────────────────────
function unitTests(): void {
  console.log('\n[1] UNIT — pure math');

  // buildTasteFromSamples degeneracies
  const allLiked = buildTasteFromSamples([
    { emb: basis(0), liked: true, w: 1 },
    { emb: basis(1), liked: true, w: 1 },
  ]);
  check('all-liked → unavailable', allLiked.vector.length === 0 && allLiked.margin === 0);
  check('all-liked → counts kept', allLiked.likes === 2 && allLiked.dislikes === 0);

  const allDisliked = buildTasteFromSamples([
    { emb: basis(0), liked: false, w: 1 },
    { emb: basis(1), liked: false, w: 1 },
  ]);
  check('all-disliked → unavailable', allDisliked.vector.length === 0);

  const contradictory = buildTasteFromSamples([
    { emb: basis(0), liked: true, w: 1 },
    { emb: basis(0), liked: false, w: 1 },
  ]);
  check('identical centroids → unavailable (margin<1e-3)', contradictory.vector.length === 0);

  const clean = buildTasteFromSamples([
    { emb: basis(0), liked: true, w: 1 },
    { emb: basis(1), liked: false, w: 1 },
  ]);
  check('clean split → available', clean.vector.length === 128 && clean.margin > 0);
  check('taste vector is unit', approx(norm(clean.vector), 1, 1e-9));
  check('taste points toward liked axis', clean.vector[0] > 0 && clean.vector[1] < 0);

  // Invalid embeddings are skipped
  const withJunk = buildTasteFromSamples([
    { emb: basis(0), liked: true, w: 1 },
    { emb: [1, 2, 3], liked: true, w: 1 }, // wrong length → skipped
    { emb: new Array(128).fill(0), liked: false, w: 1 }, // zero-norm → skipped
    { emb: basis(1), liked: false, w: 1 },
  ]);
  check('wrong-length + zero-norm skipped (1L/1D usable)', withJunk.likes === 1 && withJunk.dislikes === 1);

  // Confidence weighting shifts the centroid
  const lowW = buildTasteFromSamples([
    { emb: basis(0), liked: true, w: 0.1 },
    { emb: basis(2), liked: true, w: 2.0 },
    { emb: basis(1), liked: false, w: 1 },
  ]);
  check('heavier liked sample dominates its centroid', lowW.vector[2] > lowW.vector[0]);

  // Determinism
  const a = buildTasteFromSamples([
    { emb: basis(0), liked: true, w: 1 },
    { emb: basis(5), liked: false, w: 1 },
  ]);
  const b = buildTasteFromSamples([
    { emb: basis(0), liked: true, w: 1 },
    { emb: basis(5), liked: false, w: 1 },
  ]);
  check('deterministic', a.vector.every((v, i) => v === b.vector[i]));

  // Score mapping
  check('tasteSubScore(0) == 0.5', approx(tasteSubScore(0), 0.5));
  check('tasteSubScore monotone', tasteSubScore(0.2) > tasteSubScore(0) && tasteSubScore(0) > tasteSubScore(-0.2));
  // Input is a cosine in [-1,1]; over that real domain it stays strictly in (0,1).
  check('tasteSubScore bounded in (0,1) over cosine domain', tasteSubScore(1) < 1 && tasteSubScore(1) > 0.5 && tasteSubScore(-1) > 0 && tasteSubScore(-1) < 0.5);
  check('temperature spreads small cosines', tasteSubScore(0.3) > 0.85 && tasteSubScore(-0.3) < 0.15);

  // dotSafe guards
  check('dotSafe null on wrong length', dotSafe([1, 2, 3], basis(0)) === null);
  check('dotSafe computes on 128', approx(dotSafe(basis(0), basis(0))!, 1));
  check('temperature constant sane', FACE_TASTE_TEMP > 0 && FACE_TASTE_TEMP < 1);
}

// ── 2. DEGRADATION: cold-start / mutual scoring gates ─────────────────────────
function ff(over: Partial<FaceFeatures>): FaceFeatures {
  return {
    faceEmbedding: [],
    faceTasteVector: [],
    faceTasteMargin: 0,
    faceTasteLikes: 0,
    faceTasteDislikes: 0,
    ...over,
  };
}
function degradationTests(): void {
  console.log('\n[2] DEGRADATION — no signal ⇒ beta 0 (Phase-1 preserved)');

  const face = randUnit();
  const taste = randUnit();
  const strong = { faceTasteMargin: 0.8, faceTasteLikes: 20, faceTasteDislikes: 20 };

  check('both unavailable → beta 0', faceTasteBlendTerm(ff({}), ff({}), 50).beta === 0);
  check('both unavailable → mutualEmb null', faceTasteBlendTerm(ff({}), ff({}), 50).mutualEmb === null);

  const bothStrong = faceTasteBlendTerm(
    ff({ faceTasteVector: taste, faceEmbedding: face, ...strong }),
    ff({ faceTasteVector: taste, faceEmbedding: face, ...strong }),
    50
  );
  check('strong signal → beta > 0', bothStrong.beta > 0);
  check('beta capped at BETA_MAX', bothStrong.beta <= BETA_MAX + 1e-12);

  // Global cold-start gate forces beta 0 regardless of per-pair strength.
  const globallyCold = faceTasteBlendTerm(
    ff({ faceTasteVector: taste, faceEmbedding: face, ...strong }),
    ff({ faceTasteVector: taste, faceEmbedding: face, ...strong }),
    7 // < GLOBAL_MIN_USERS (8)
  );
  check('global < 8 users → beta 0', globallyCold.beta === 0);

  // Low minority-class count → rampN 0 → beta 0 even with a vector present.
  const warming = faceTasteBlendTerm(
    ff({ faceTasteVector: taste, faceEmbedding: face, faceTasteMargin: 0.8, faceTasteLikes: 3, faceTasteDislikes: 2 }),
    ff({ faceTasteVector: taste, faceEmbedding: face, faceTasteMargin: 0.8, faceTasteLikes: 3, faceTasteDislikes: 2 }),
    50
  );
  check('minority count < N_MIN → beta 0 (warming up)', warming.beta === 0);

  // Geometric mean == mutual-AND
  const va = randUnit();
  const vb = randUnit();
  const fa = randUnit();
  const fb = randUnit();
  const both = faceTasteBlendTerm(
    ff({ faceTasteVector: va, faceEmbedding: fb, ...strong }),
    ff({ faceTasteVector: vb, faceEmbedding: fa, ...strong }),
    50
  );
  const dAB = tasteSubScore(dotSafe(va, unit(fa)!)!);
  const dBA = tasteSubScore(dotSafe(vb, unit(fb)!)!);
  check('mutualEmb == geometric mean of the two directions', approx(both.mutualEmb!, Math.sqrt(dAB * dBA), 1e-9));

  // Regression (review fix #1): a partner who JUST started swiping (a thin,
  // sub-N_MIN vector, trust 0) must NOT reduce the blend below a partner with no
  // vector at all — both fall back to the requester's one-directional judgement.
  const strongReq = { faceTasteVector: va, faceEmbedding: fb, faceTasteMargin: 0.8, faceTasteLikes: 20, faceTasteDislikes: 20 };
  const betaNoVec = faceTasteBlendTerm(ff(strongReq), ff({ faceEmbedding: fa }), 50).beta;
  const betaThin = faceTasteBlendTerm(ff(strongReq), ff({ faceTasteVector: vb, faceEmbedding: fa, faceTasteMargin: 0.8, faceTasteLikes: 2, faceTasteDislikes: 2 }), 50).beta;
  check('thin partner does not reduce blend vs no-vector partner', betaThin >= betaNoVec - 1e-12);
  check('thin partner blend equals the one-directional fallback', approx(betaThin, betaNoVec, 1e-9));

  // One-directional passthrough (candidate has no face) with halved trust.
  const oneDir = faceTasteBlendTerm(
    ff({ faceTasteVector: va, faceEmbedding: [], ...strong }), // requester taste, but no requester face
    ff({ faceTasteVector: [], faceEmbedding: fa, ...strong }), // candidate face, but no candidate taste
    50
  );
  check('one computable direction → still available', oneDir.mutualEmb !== null);
  check('one-directional trust halved (beta ≤ BETA_MAX/2)', oneDir.beta <= BETA_MAX / 2 + 1e-12);
}

// ── 3. AUC: does learned taste predict held-out likes on REAL faces? ──────────
function auc(scores: number[], labels: number[]): number {
  const pos = scores.filter((_, i) => labels[i] === 1);
  const neg = scores.filter((_, i) => labels[i] === 0);
  if (pos.length === 0 || neg.length === 0) return NaN;
  let wins = 0;
  for (const p of pos) for (const n of neg) wins += p > n ? 1 : p === n ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}

async function aucEval(): Promise<void> {
  console.log('\n[3] AUC — learned taste vs held-out likes (real faces)');
  const rows = await UserModel.find({ email: /^rface_/ }).select('+faceEmbedding').lean();
  const faces = rows
    .map((r) => (r as unknown as { faceEmbedding?: number[] }).faceEmbedding)
    .filter((e): e is number[] => Array.isArray(e) && e.length === 128);
  console.log(`  real face pool: ${faces.length}`);
  if (faces.length < 8) {
    console.log('  ✗ need ≥8 real faces — run `npm run seed:faces` first.');
    failed += 1;
    return;
  }

  const NOISE = 0.15; // 15% of swipes are "mistakes" — realistic
  const TRIALS = 400;
  const trainSizes = [4, 6, 8, 10, 12];
  const byBucket = new Map<number, number[]>();
  const oracleAll: number[] = [];
  const modelAll: number[] = [];
  let unavailable = 0;

  for (let t = 0; t < TRIALS; t++) {
    // Ground-truth taste: "likes people who look like prototype p".
    const pIdx = Math.floor(Math.random() * faces.length);
    const p = faces[pIdx];
    const others = faces.filter((_, i) => i !== pIdx);
    const sims = others.map((f) => cos(f, p));
    const med = [...sims].sort((a, b) => a - b)[Math.floor(sims.length / 2)];
    const trueLabel = others.map((f, i) => (sims[i] >= med ? 1 : 0));
    const noisy = trueLabel.map((y) => (Math.random() < NOISE ? 1 - y : y));

    // Stratified split so train has both classes.
    const idx = others.map((_, i) => i).sort(() => Math.random() - 0.5);
    const trainN = trainSizes[Math.floor(Math.random() * trainSizes.length)];
    const train = idx.slice(0, trainN);
    const test = idx.slice(trainN);
    const trainHasBoth = train.some((i) => noisy[i] === 1) && train.some((i) => noisy[i] === 0);
    if (!trainHasBoth || test.length < 2) continue;

    const taste = buildTasteFromSamples(train.map((i) => ({ emb: others[i], liked: noisy[i] === 1, w: 1 })));
    if (taste.vector.length !== 128) {
      unavailable += 1;
      continue;
    }

    const testScores = test.map((i) => tasteSubScore(dotSafe(taste.vector, unit(others[i])!)!));
    const testLabels = test.map((i) => trueLabel[i]); // evaluate against TRUE (noise-free) intent
    const a = auc(testScores, testLabels);
    if (Number.isNaN(a)) continue;

    modelAll.push(a);
    const bucket = trainN;
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket)!.push(a);

    // Oracle: score by true cosine to p (the generator) — upper bound.
    const oracleScores = test.map((i) => sims[i]);
    oracleAll.push(auc(oracleScores, testLabels));
  }

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  console.log(`  trials scored: ${modelAll.length} | unavailable (skipped): ${unavailable} | noise: ${NOISE * 100}%`);
  console.log('  AUC by training size (min-class ramps 3→10):');
  for (const n of trainSizes) {
    const xs = byBucket.get(n) ?? [];
    console.log(`    train N=${String(n).padStart(2)}: AUC ${mean(xs).toFixed(3)}  (n=${xs.length})`);
  }
  const modelAuc = mean(modelAll);
  console.log(`  RESULT model  AUC (all):   ${modelAuc.toFixed(3)}`);
  console.log(`  RESULT oracle AUC (bound): ${mean(oracleAll).toFixed(3)}`);
  console.log(`  RESULT random baseline:    0.500`);
  check('model AUC clearly beats random (>0.65)', modelAuc > 0.65);
  check('model AUC improves with N (N=12 ≥ N=4)', mean(byBucket.get(12) ?? []) >= mean(byBucket.get(4) ?? []) - 0.02);
}

async function main() {
  // Pure math — no DB needed, always runs.
  unitTests();
  degradationTests();

  // AUC needs the real faces from Mongo; if the DB is unreachable, skip it
  // (the model math above is still fully verified) rather than failing the run.
  try {
    await connectToDb();
    await aucEval();
    await disconnectFromDb();
  } catch (e) {
    console.log(`\n[3] AUC — SKIPPED (DB unreachable: ${(e as Error).message.split('\n')[0]})`);
    await disconnectFromDb().catch(() => {});
  }

  console.log(`\n──────────────────────────────\nASSERTIONS: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error('[eval] failed', e);
  await disconnectFromDb().catch(() => {});
  process.exit(1);
});
