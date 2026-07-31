// Pretrained face-embedding pipeline (Phase 1 of the "learn a user's visual
// taste" design). We do NOT train a model here — we use pretrained nets from
// @vladmandic/face-api (a maintained face-api.js fork):
//   ssdMobilenetv1  → detect the face
//   faceLandmark68  → align it
//   faceRecognition → 128-d face descriptor (the embedding)
//
// The embedding is computed ONCE per photo (at registration / photo change) and
// stored on the user. Matching never runs vision on the hot path — a future
// per-user taste model just does cheap math on these stored vectors.
//
// Runs on the pure-JS tfjs CPU backend (no native build — @tensorflow/tfjs-node
// has no prebuilt for Node 24). sharp decodes images into tensors.

import * as path from 'path';
import sharp, { OutputInfo } from 'sharp';
import * as tf from '@tensorflow/tfjs';
import { UserModel } from '../models/User';

export const FACE_EMBEDDING_DIM = 128;
// Detection is faster and lighter on a downscaled image; faces still resolve well.
const MAX_DIM = 640;
const MIN_CONFIDENCE = 0.5;

// @vladmandic/face-api ships only an ESM build. A static import works under tsx
// but would break the compiled CommonJS build (`require()` of an ESM file), so
// we load it via a genuine dynamic import that survives tsc's CJS emit. This
// also keeps the heavy tfjs/face-api load lazy — nothing loads until the first
// embedding is requested. It shares this file's tf instance (same tfjs package).
const importESM = new Function('m', 'return import(m)') as (m: string) => Promise<any>;

let faceapi: any = null;
let ready: Promise<void> | null = null;

/** Load tfjs CPU backend + face-api + the three nets once, from the package. */
function ensureLoaded(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    faceapi = await importESM('@vladmandic/face-api/dist/face-api.esm-nobundle.js');
    await tf.setBackend('cpu');
    await tf.ready();
    const modelDir = path.join(
      path.dirname(require.resolve('@vladmandic/face-api/package.json')),
      'model'
    );
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelDir);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelDir);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelDir);
    console.log('[face] models loaded (tfjs backend:', tf.getBackend() + ')');
  })();
  return ready;
}

/** Accept a data URI, an http(s) URL, a raw base64 string, or a Buffer. */
async function toImageBuffer(image: string | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(image)) return image;
  if (image.startsWith('data:')) {
    const comma = image.indexOf(',');
    return Buffer.from(image.slice(comma + 1), 'base64');
  }
  if (image.startsWith('http://') || image.startsWith('https://')) {
    const res = await fetch(image);
    if (!res.ok) throw new Error(`could not fetch image (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  return Buffer.from(image, 'base64');
}

/**
 * A detected face: its 128-d descriptor plus two clarity signals — the
 * detector's confidence and the sharpness of the face region. Used by
 * computeEmbeddingForPhotos to pick the CLEAREST photo, not just the first.
 */
type DetectedFace = { embedding: number[]; score: number; sharpness: number; isSolo: boolean };

/**
 * Variance of the Laplacian over the face box — the standard focus/blur metric.
 * A sharp, in-focus face has strong local intensity changes (high variance); a
 * blurry one is smooth (low variance). Runs on the already-decoded pixels, so
 * it's essentially free. Box coords are in the resized image's pixel space.
 * Exported for unit testing.
 */
export function faceSharpness(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  box: { x: number; y: number; width: number; height: number }
): number {
  const x0 = Math.max(1, Math.floor(box.x));
  const y0 = Math.max(1, Math.floor(box.y));
  const x1 = Math.min(width - 2, Math.floor(box.x + box.width));
  const y1 = Math.min(height - 2, Math.floor(box.y + box.height));
  if (x1 <= x0 || y1 <= y0) return 0;

  const lum = (px: number, py: number): number => {
    const i = (py * width + px) * channels;
    return channels >= 3 ? 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] : data[i];
  };

  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let py = y0; py <= y1; py += 1) {
    for (let px = x0; px <= x1; px += 1) {
      const lap =
        4 * lum(px, py) - lum(px - 1, py) - lum(px + 1, py) - lum(px, py - 1) - lum(px, py + 1);
      sum += lap;
      sumSq += lap * lap;
      n += 1;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return Math.max(0, sumSq / n - mean * mean);
}

/**
 * Detect the single strongest face in one image and return its descriptor plus
 * clarity signals. Returns null when no face is detected or the image can't be
 * decoded (e.g. the seed placeholders, which contain no real face).
 */
async function detectFace(image: string | Buffer): Promise<DetectedFace | null> {
  await ensureLoaded();

  let raw: { data: Buffer; info: OutputInfo };
  try {
    const buffer = await toImageBuffer(image);
    raw = await sharp(buffer)
      .rotate() // honor EXIF orientation
      .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
      .removeAlpha() // force 3 channels
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    return null;
  }

  const { data, info } = raw;
  const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], 'int32');
  try {
    // detectAllFaces (not single) so we can tell a solo photo from a group and,
    // in a group, deliberately pick the LARGEST face (closest to camera ≈ the
    // subject) rather than whichever face the detector is most confident about.
    const detections: any[] = await faceapi
      .detectAllFaces(tensor as any, new faceapi.SsdMobilenetv1Options({ minConfidence: MIN_CONFIDENCE }))
      .withFaceLandmarks()
      .withFaceDescriptors();
    const faces = (detections ?? []).filter((d) => d?.descriptor);
    if (faces.length === 0) return null;

    const isSolo = faces.length === 1;
    const boxArea = (d: any): number => {
      const b = d.detection?.box;
      return b ? b.width * b.height : 0;
    };
    const chosen = isSolo ? faces[0] : faces.reduce((a, b) => (boxArea(b) > boxArea(a) ? b : a));

    const box = chosen.detection?.box;
    const score: number = chosen.detection?.score ?? 0;
    const sharpness = box ? faceSharpness(data, info.width, info.height, info.channels, box) : 0;
    return { embedding: Array.from(chosen.descriptor as Float32Array), score, sharpness, isSolo };
  } catch {
    return null;
  } finally {
    tensor.dispose();
  }
}

/**
 * Compute the 128-d face embedding for a single image (its strongest face), or
 * null when no face is detected / the image can't be decoded.
 */
export async function computeFaceEmbedding(image: string | Buffer): Promise<number[] | null> {
  return (await detectFace(image))?.embedding ?? null;
}

/**
 * Choose the best face from a set of detected photos. Pure policy, exported for
 * unit tests:
 *
 *  1. SOLO photos win outright — a photo with exactly one face is unambiguously
 *     the user, so a group photo is only ever used when NO solo photo has a face.
 *  2. Within the winning tier, take the CLEAREST face (highest clarity =
 *     detection confidence × sharpness).
 *
 * So a crisp solo selfie always beats a group shot, even a sharper one.
 */
export function pickClearestFace<T extends { clarity: number; isSolo: boolean }>(
  faces: T[]
): T | null {
  const solo = faces.filter((f) => f.isSolo);
  const pool = solo.length > 0 ? solo : faces;
  let best: T | null = null;
  for (const f of pool) {
    if (!best || f.clarity > best.clarity) best = f;
  }
  return best;
}

/**
 * Pick the best photo of the bunch and return its face embedding — prefer the
 * clearest SOLO photo, falling back to the clearest group photo (whose chosen
 * face is the largest, see detectFace). Photos with no detectable face are
 * skipped; null if none have a face at all.
 */
export async function computeEmbeddingForPhotos(photos: string[]): Promise<number[] | null> {
  const faces: { embedding: number[]; clarity: number; isSolo: boolean }[] = [];
  for (const photo of photos) {
    if (typeof photo !== 'string' || !photo) continue;
    const face = await detectFace(photo);
    if (!face) continue;
    faces.push({ embedding: face.embedding, clarity: face.score * face.sharpness, isSolo: face.isSolo });
  }
  return pickClearestFace(faces)?.embedding ?? null;
}

/**
 * Compute and persist a user's face embedding from their photos. Safe to call
 * fire-and-forget from request handlers — it swallows its own errors so a
 * failed/absent face never blocks registration or a profile edit.
 */
export async function updateUserFaceEmbedding(
  userId: string,
  photos: string[]
): Promise<number[] | null> {
  try {
    const embedding = await computeEmbeddingForPhotos(photos);
    await UserModel.updateOne({ _id: userId }, { faceEmbedding: embedding ?? [] });
    console.log(
      `[face] ${embedding ? `stored ${embedding.length}-d embedding` : 'no face found'} for user ${userId}`
    );
    return embedding;
  } catch (e) {
    console.warn('[face] embedding update failed for', userId, (e as Error).message);
    return null;
  }
}
