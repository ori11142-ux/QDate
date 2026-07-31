/**
 * Simulate looks-calibration swipes for the real-face test users so the Phase 2
 * face-taste model has data to work with.
 *
 *   npm run sim:swipes            # every real-face user
 *   npm run sim:swipes -- 12      # just 12 of them
 *
 * Each simulated user is given a random "type" (a prototype face) and likes the
 * candidates whose face is closest to it (median split + 10% mislabels), then
 * their taste vector is recomputed. Idempotent — replaces prior looks-swipes.
 */

import 'dotenv/config';
import { connectToDb, disconnectFromDb } from '../config/db';
import { UserModel } from '../models/User';
import { SwipeModel } from '../models/Swipe';
import { updateFaceTaste, getGlobalUsableTasteUsers, invalidateGlobalCount } from '../ml/faceTaste';

function cos(a: number[], b: number[]): number {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na) * Math.sqrt(nb));
}

async function main() {
  await connectToDb();
  const limit = process.argv[2] ? parseInt(process.argv[2], 10) : Infinity;

  const all: any[] = await UserModel.find({}).select('+faceEmbedding name gender').lean();
  const withFace = all.filter((u) => Array.isArray(u.faceEmbedding) && u.faceEmbedding.length === 128);
  const women = withFace.filter((u) => u.gender === 'woman');
  const men = withFace.filter((u) => u.gender === 'man');

  const swipers = withFace.slice(0, Math.min(limit, withFace.length));
  console.log(`[sim] simulating looks-swipes for ${swipers.length} users…`);

  let done = 0;
  for (const s of swipers) {
    const pool = (s.gender === 'woman' ? men : women).filter((c) => String(c._id) !== String(s._id));
    if (pool.length < 8) continue;
    const proto = pool[Math.floor(Math.random() * pool.length)].faceEmbedding as number[];
    const rated = pool.slice().sort(() => Math.random() - 0.5).slice(0, 14);
    const sims = rated.map((c) => cos(c.faceEmbedding, proto));
    const med = [...sims].sort((a, b) => a - b)[Math.floor(sims.length / 2)];

    await SwipeModel.deleteMany({ userId: s._id, mode: 'looks' });
    await SwipeModel.insertMany(rated.map((c, i) => ({
      userId: s._id,
      cardId: String(c._id),
      mode: 'looks' as const,
      liked: (sims[i] >= med) !== (Math.random() < 0.1),
      responseTimeMs: 800 + Math.floor(Math.random() * 3200),
      swipedAt: new Date(),
    })));
    await updateFaceTaste(String(s._id));
    done += 1;
  }

  invalidateGlobalCount();
  const usable = await getGlobalUsableTasteUsers();
  console.log(`[sim] done. ${done} users swiped; ${usable} now have a usable taste vector (blend activates at >= 8).`);
  await disconnectFromDb();
}

main().catch(async (e) => { console.error('[sim] failed', e?.stack ?? e); await disconnectFromDb().catch(() => {}); process.exit(1); });
