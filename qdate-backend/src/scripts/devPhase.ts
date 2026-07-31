/**
 * Dev/testing tool: jump a user to Phase 2 (or back to Phase 1) instantly by
 * faking their account age past (or within) the 14-day learning window.
 *
 *   npm run dev:phase -- Hila 2     # → Phase 2 (aged 25 days), generates a curated match
 *   npm run dev:phase -- Hila 1     # → Phase 1 (fresh account)
 *   npm run dev:phase -- someone@qdate.test 2
 *
 * Also clears any skip cooldown and resets the user's match history so cadence /
 * already-matched exclusions don't block the test. Reload the app afterward.
 */

import 'dotenv/config';
import { connectToDb, disconnectFromDb } from '../config/db';
import { UserModel } from '../models/User';
import { MatchModel } from '../models/Match';
import { generateMatchForUser, toClientMatch } from '../services/matchmaker';

const DAY = 24 * 60 * 60 * 1000;

async function main() {
  await connectToDb();
  const who = process.argv[2] ?? 'Hila';
  const toPhase2 = (process.argv[3] ?? '2') === '2';

  const user = await UserModel.findOne(
    who.includes('@') ? { email: who.toLowerCase() } : { name: who }
  ).select('_id name');
  if (!user) {
    console.log(`User not found: "${who}"`);
    await disconnectFromDb();
    return;
  }
  const id = user._id;

  // createdAt is immutable under Mongoose timestamps → patch via the raw driver.
  const createdAt = toPhase2 ? new Date(Date.now() - 25 * DAY) : new Date();
  await UserModel.collection.updateOne(
    { _id: id },
    { $set: { createdAt, currentPhase: toPhase2 ? 'phase_2' : 'phase_1', cooldownUntil: null } }
  );
  // Reset all matches involving this user so cadence + already-matched exclusions are clean.
  const cleared = await MatchModel.deleteMany({ $or: [{ userId: id }, { candidateUserId: id }] });

  console.log(
    `${user.name} → ${toPhase2 ? 'PHASE 2 (account aged 25 days)' : 'PHASE 1 (fresh account)'} | cooldown cleared | ${cleared.deletedCount} matches reset.`
  );

  if (toPhase2) {
    const res = await generateMatchForUser(String(id), 'phase_2');
    if (res) {
      const c = toClientMatch(res.match, res.candidate);
      console.log(`✅ Curated match ready: ${c.candidateName}, ${c.candidateAge} (phase=${c.phase}). Reload the app.`);
    } else {
      console.log('⚠️  No curated match generated — best candidate scored below the Phase-2 quality bar (72). The app will show "no match" in Phase 2. Tell me and I can lower the bar for testing.');
    }
  } else {
    console.log('Reload the app — a fresh daily (Phase 1) match will generate.');
  }

  await disconnectFromDb();
}

main().catch(async (e) => {
  console.error('[dev:phase] failed', e?.stack ?? e);
  await disconnectFromDb().catch(() => {});
  process.exit(1);
});
