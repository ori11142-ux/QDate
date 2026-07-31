/**
 * Seed a pool of users that are already in PHASE 2, so the curated weekly-match
 * flow can be tested end-to-end. Each user gets:
 *   - a real, gender-matched face (randomuser.me) + computed embedding
 *   - a profile aligned enough that Phase-2 scores clear the quality bar (72)
 *   - an account aged 25 days (past the 14-day learning window) + currentPhase
 *     'phase_2', so the app treats them as Phase-2 immediately.
 *
 *   npm run seed:phase2
 *
 * Re-running replaces the previous batch (matched by the p2_ email prefix).
 * All accounts share the password below. After seeding, log in as any of them
 * (or flip your own account with `npm run dev:phase -- <you> 2`) and request a
 * curated match.
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectToDb, disconnectFromDb } from '../config/db';
import { UserModel } from '../models/User';
import { MatchModel } from '../models/Match';
import { updateUserFaceEmbedding } from '../ml/faceEmbedding';
import { generateMatchForUser } from '../services/matchmaker';

const PASSWORD = 'qdate1234';
const DAY = 24 * 60 * 60 * 1000;
const AGE_BACK_DAYS = 25; // > 14-day learning period → Phase 2

type Gender = 'man' | 'woman';
type Attraction = 'men' | 'women';

// Distinct randomuser.me portrait indices per gender (stable public URLs).
const WOMEN_IDX = [12, 19, 28, 41];
const MEN_IDX = [7, 15, 29, 46];
const NAMES_W = ['Maya', 'Noa', 'Shira', 'Yael'];
const NAMES_M = ['Omer', 'Dan', 'Yoav', 'Amit'];

// Heavily-overlapping interests + shared intent/comm style so any two of these
// score well above the Phase-2 quality bar (72), while still varying a little.
const INTEREST_VARIANTS = [
  ['hiking', 'travel', 'coffee', 'reading', 'film'],
  ['hiking', 'travel', 'coffee', 'reading', 'foodie'],
  ['hiking', 'travel', 'coffee', 'live_music', 'film'],
  ['running', 'travel', 'coffee', 'reading', 'film'],
];

function portrait(gender: Gender, idx: number): string {
  return `https://randomuser.me/api/portraits/${gender === 'woman' ? 'women' : 'men'}/${idx}.jpg`;
}

type Spec = {
  name: string;
  gender: Gender;
  attraction: Attraction;
  age: number;
  photo: string;
  interests: string[];
  i: number;
};

function buildSpecs(): Spec[] {
  const specs: Spec[] = [];
  let i = 0;
  WOMEN_IDX.forEach((idx, k) => {
    specs.push({
      name: NAMES_W[k],
      gender: 'woman',
      attraction: 'men',
      age: 26 + k,
      photo: portrait('woman', idx),
      interests: INTEREST_VARIANTS[k % INTEREST_VARIANTS.length],
      i: i++,
    });
  });
  MEN_IDX.forEach((idx, k) => {
    specs.push({
      name: NAMES_M[k],
      gender: 'man',
      attraction: 'women',
      age: 28 + k,
      photo: portrait('man', idx),
      interests: INTEREST_VARIANTS[k % INTEREST_VARIANTS.length],
      i: i++,
    });
  });
  return specs;
}

async function main() {
  await connectToDb();

  const removed = await UserModel.deleteMany({ email: /^p2_/ });
  console.log(`[phase2] removed ${removed.deletedCount} previous phase-2 test users.`);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const specs = buildSpecs();
  const agedCreatedAt = new Date(Date.now() - AGE_BACK_DAYS * DAY);

  console.log(`[phase2] creating ${specs.length} phase-2 users (accounts aged ${AGE_BACK_DAYS} days)…`);
  let embedded = 0;
  for (const s of specs) {
    const email = `p2_${s.gender}_${s.i}@qdate.test`;
    const photos = [s.photo, s.photo, s.photo, s.photo]; // 4 required; same real face
    const user = await UserModel.create({
      email,
      name: s.name,
      age: s.age,
      authMethod: 'email',
      gender: s.gender,
      attraction: s.attraction,
      agePreference: { min: 18, max: 99 },
      photoUrl: s.photo,
      photos,
      bio: `${s.name} — phase-2 test profile`,
      passwordHash,
      profile: { intent: 'long_term', sharedIntellectImportance: 3, commStyle: 'texting_first' },
      interestTags: s.interests,
      currentPhase: 'phase_2',
      guidelinesAcceptedVersion: '1.0',
      guidelinesAcceptedAt: new Date(),
    });

    // createdAt is immutable under Mongoose timestamps → patch via the raw driver
    // to age the account past the learning window, and pin the phase.
    await UserModel.collection.updateOne(
      { _id: user._id },
      { $set: { createdAt: agedCreatedAt, currentPhase: 'phase_2', cooldownUntil: null } }
    );

    const emb = await updateUserFaceEmbedding(String(user._id), photos);
    if (emb) embedded += 1;
    console.log(`  ${email.padEnd(24)} ${s.gender}/${s.attraction} age ${s.age}  face=${emb ? emb.length + 'd' : 'NONE'}`);
  }

  // Verify Phase-2 matching actually produces a curated match from this pool
  // (i.e. the best pair clears the quality bar), then wipe the verification
  // matches so every seeded user starts free for you to test with.
  const first = await UserModel.findOne({ email: `p2_woman_0@qdate.test` }).select('_id name');
  if (first) {
    const res = await generateMatchForUser(String(first._id), 'phase_2');
    console.log(
      res
        ? `[phase2] ✅ verified: ${first.name} → curated match "${res.candidate.name}" (cleared the 72 quality bar).`
        : `[phase2] ⚠️  ${first.name} got NO phase-2 match — best pair scored below 72. Tell me and I'll tighten the pool.`
    );
  }
  const p2Ids = (await UserModel.find({ email: /^p2_/ }).select('_id').lean()).map((u) => u._id);
  await MatchModel.deleteMany({ $or: [{ userId: { $in: p2Ids } }, { candidateUserId: { $in: p2Ids } }] });

  console.log(`\n[phase2] done. ${specs.length} users in PHASE 2 (${embedded} with a face embedding), all free.`);
  console.log(`[phase2] password for all: ${PASSWORD}`);
  console.log(`[phase2] log in as e.g. p2_woman_0@qdate.test or p2_man_4@qdate.test,`);
  console.log(`[phase2] or flip your own account to Phase 2:  npm run dev:phase -- <your name or email> 2`);
  await disconnectFromDb();
}

main().catch(async (e) => {
  console.error('[phase2] failed', e?.stack ?? e);
  await disconnectFromDb().catch(() => {});
  process.exit(1);
});
