/**
 * Show how a requester's matches are scored — the effect of learned face-taste
 * and shared interests.
 *
 *   npm run demo:matching                       # auto-pick a requester with taste
 *   npm run demo:matching -- rface_man_111@qdate.test
 *
 * Read-only. For each candidate it prints the interest overlap, the requester's
 * learned face-taste toward that candidate, and the 0–100 match score with the
 * taste blend forced OFF (Phase-1 tag-only looks) vs ON (blended). Requires that
 * ≥8 users already have taste vectors (run the swipe simulation first).
 */

import 'dotenv/config';
import { connectToDb, disconnectFromDb } from '../config/db';
import { UserModel, UserDoc } from '../models/User';
import { extractUserFeatures } from '../ml/features';
import { learnWeightsFromOutcomes, scoreFromFeatures } from '../ml/ranker';
import { getGlobalUsableTasteUsers, unit, dotSafe, tasteSubScore } from '../ml/faceTaste';

const SELECT = '+faceEmbedding +faceTasteVector +faceTasteMargin +faceTasteLikes +faceTasteDislikes';

function overlap(a: string[] = [], b: string[] = []): number {
  if (!a.length || !b.length) return 0.5;
  const setB = new Set(b);
  return a.filter((t) => setB.has(t)).length / Math.max(a.length, b.length);
}

async function main() {
  await connectToDb();
  const globalCount = await getGlobalUsableTasteUsers();

  const wantEmail = process.argv[2];
  const requester = (wantEmail
    ? await UserModel.findOne({ email: wantEmail }).select(SELECT)
    : (await UserModel.find({ faceTasteMargin: { $gt: 0 }, faceTasteLikes: { $gte: 3 }, faceTasteDislikes: { $gte: 3 } }).select(SELECT))[0]) as UserDoc | undefined;
  if (!requester) { console.log('No requester with an active taste vector — run the swipe simulation first.'); await disconnectFromDb(); return; }

  const wantGender = requester.attraction === 'men' ? 'man' : requester.attraction === 'women' ? 'woman' : null;
  const candidates = await UserModel.find({
    _id: { $ne: requester._id },
    ...(wantGender ? { gender: wantGender } : {}),
  }).select(SELECT);

  const rf = await extractUserFeatures(requester);
  const weights = await learnWeightsFromOutcomes();
  const rTaste = requester.get('faceTasteVector') as number[];

  const rows = [];
  for (const c of candidates) {
    const cf = await extractUserFeatures(c);
    const cFace = unit((c.get('faceEmbedding') as number[]) ?? []);
    const taste = cFace && rTaste.length === 128 ? tasteSubScore(dotSafe(rTaste, cFace)!) : 0.5;
    rows.push({
      name: (c as any).name,
      ov: overlap(rf.interestTags, cf.interestTags),
      taste,
      off: scoreFromFeatures(rf, cf, weights, 7), // taste blend gated OFF
      on: scoreFromFeatures(rf, cf, weights, globalCount), // taste blend ON
    });
  }
  rows.sort((a, b) => b.on - a.on);

  const R = (requester as any).name;
  console.log(`\n=== ${R} — ${candidates.length} candidates (global taste users=${globalCount}) ===`);
  console.log(`weights → looks ${(weights.looks).toFixed(2)}, interests ${(weights.interests).toFixed(2)} (normalized)\n`);
  console.log(`rank  candidate     interest-overlap   ${R}'s face-taste   match OFF→ON`);
  rows.forEach((r, i) => {
    const d = r.on - r.off;
    console.log(
      `${String(i + 1).padStart(2)}.  ${r.name.padEnd(12)} ${(r.ov * 100).toFixed(0).padStart(6)}%           ${r.taste.toFixed(2).padStart(6)}          ${String(r.off).padStart(3)} → ${String(r.on).padStart(3)}  (${d >= 0 ? '+' : ''}${d})`
    );
  });

  const withTaste = rows.filter((r) => r.on !== r.off);
  console.log(`\n• Interests now move the base score: overlap ranges ${(Math.min(...rows.map((r) => r.ov)) * 100).toFixed(0)}%–${(Math.max(...rows.map((r) => r.ov)) * 100).toFixed(0)}% across candidates and feeds ~${(weights.interests * 100).toFixed(0)}% of the score.`);
  console.log(`• Face-taste now moves ${withTaste.length}/${rows.length} candidates (OFF→ON delta up to ${Math.max(0, ...rows.map((r) => Math.abs(r.on - r.off)))} pts).`);
  await disconnectFromDb();
}

main().catch(async (e) => { console.error('[demo] failed', e?.stack ?? e); await disconnectFromDb().catch(() => {}); process.exit(1); });
