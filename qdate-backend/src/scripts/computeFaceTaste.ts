/**
 * Backfill per-user face-taste vectors from existing looks-swipes.
 *
 *   npm run face-taste
 *
 * Recompute-on-swipe keeps these fresh going forward; run this once after
 * deploying Phase 2 (or after a bulk face-embedding backfill). Users without a
 * liked-and-disliked pair of usable looks-swipes are recorded as unavailable.
 */

import 'dotenv/config';
import { connectToDb, disconnectFromDb } from '../config/db';
import { SwipeModel } from '../models/Swipe';
import { updateFaceTaste } from '../ml/faceTaste';

async function main() {
  await connectToDb();

  // Only users who have at least one 'looks' swipe can have a taste vector.
  const userIds = await SwipeModel.distinct('userId', { mode: 'looks' });
  console.log(`[face-taste] recomputing for ${userIds.length} user(s) with looks-swipes…`);

  let usable = 0;
  for (const uid of userIds) {
    const t = await updateFaceTaste(String(uid));
    if (t && t.vector.length === 128) usable += 1;
  }

  console.log(`[face-taste] done. ${usable}/${userIds.length} have a usable taste vector.`);
  await disconnectFromDb();
}

main().catch(async (e) => {
  console.error('[face-taste] failed', e);
  await disconnectFromDb().catch(() => {});
  process.exit(1);
});
