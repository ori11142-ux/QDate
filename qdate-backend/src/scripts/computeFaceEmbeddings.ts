/**
 * Backfill face embeddings for existing users.
 *
 *   npm run embeddings            # only users missing an embedding
 *   npm run embeddings -- --all   # recompute for everyone
 *
 * Seed profiles use synthetic placeholder photos (no real face), so they'll be
 * recorded as "no face" — that's expected. Real accounts with real photos get a
 * 128-d embedding stored.
 */

import 'dotenv/config';
import { connectToDb, disconnectFromDb } from '../config/db';
import { UserModel } from '../models/User';
import { updateUserFaceEmbedding } from '../ml/faceEmbedding';

async function main() {
  const recomputeAll = process.argv.includes('--all');
  await connectToDb();

  const query = recomputeAll ? {} : { faceEmbedding: { $size: 0 } };
  const users = await UserModel.find(query).select('_id name photos');
  console.log(`[embeddings] processing ${users.length} user(s) (${recomputeAll ? 'all' : 'missing only'})…`);

  let withFace = 0;
  let noFace = 0;
  for (const u of users) {
    const photos = (u.get('photos') as string[] | undefined) ?? [];
    const emb = await updateUserFaceEmbedding(String(u._id), photos);
    if (emb) withFace += 1;
    else noFace += 1;
  }

  console.log(`[embeddings] done. ${withFace} with a face, ${noFace} without.`);
  await disconnectFromDb();
}

main().catch(async (e) => {
  console.error('[embeddings] failed', e);
  await disconnectFromDb().catch(() => {});
  process.exit(1);
});
