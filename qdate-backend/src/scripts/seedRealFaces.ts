/**
 * Seed test users with REAL, gender-matched faces (from randomuser.me) and
 * compute their pretrained face embeddings — so Phase 2 (face-taste learning)
 * can be tested on genuine data. Seed profiles use synthetic placeholders with
 * no detectable face; these do not.
 *
 *   npm run seed:faces
 *
 * Re-running replaces the previous batch (matched by the rface_ email prefix).
 * All accounts share the password below.
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectToDb, disconnectFromDb } from '../config/db';
import { UserModel } from '../models/User';
import { updateUserFaceEmbedding } from '../ml/faceEmbedding';

const PASSWORD = 'qdate1234';

type Gender = 'man' | 'woman';
type Attraction = 'men' | 'women' | 'both';

// Distinct randomuser.me portrait indices per gender (stable public URLs).
const WOMEN = [1, 5, 9, 16, 23, 26, 33, 40, 55, 68];
const MEN = [3, 11, 22, 33, 44, 51, 65, 75];

const FIRST_NAMES_W = ['Ava', 'Mia', 'Zoe', 'Lena', 'Nina', 'Ruth', 'Dana', 'Tal', 'Gaia', 'Rona'];
const FIRST_NAMES_M = ['Leo', 'Max', 'Eli', 'Guy', 'Ron', 'Ido', 'Nir', 'Aviv'];

const INTENTS = ['long_term', 'casual', 'explore', 'friendship'] as const;
const COMMS = ['texting_first', 'voice_early', 'meet_in_person'] as const;
const INTEREST_SETS = [
  ['hiking', 'running', 'fitness', 'nature', 'travel'],
  ['cooking', 'foodie', 'coffee', 'reading', 'film'],
  ['live_music', 'art', 'photography', 'nightlife', 'travel'],
  ['yoga', 'nature', 'reading', 'volunteering', 'coffee'],
];

function portrait(gender: Gender, idx: number): string {
  return `https://randomuser.me/api/portraits/${gender === 'woman' ? 'women' : 'men'}/${idx}.jpg`;
}

type Spec = { name: string; gender: Gender; attraction: Attraction; age: number; photo: string; i: number };

function buildSpecs(): Spec[] {
  const specs: Spec[] = [];
  let i = 0;
  WOMEN.forEach((idx, k) => {
    specs.push({
      name: FIRST_NAMES_W[k % FIRST_NAMES_W.length],
      gender: 'woman',
      attraction: 'men',
      age: 24 + (k % 12),
      photo: portrait('woman', idx),
      i: i++,
    });
  });
  MEN.forEach((idx, k) => {
    specs.push({
      name: FIRST_NAMES_M[k % FIRST_NAMES_M.length],
      gender: 'man',
      attraction: 'women',
      age: 25 + (k % 12),
      photo: portrait('man', idx),
      i: i++,
    });
  });
  return specs;
}

async function main() {
  await connectToDb();

  const removed = await UserModel.deleteMany({ email: /^rface_/ });
  console.log(`[faces] removed ${removed.deletedCount} previous real-face test users.`);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const specs = buildSpecs();

  console.log(`[faces] creating ${specs.length} users with real faces…`);
  let embedded = 0;
  for (const s of specs) {
    const email = `rface_${s.gender}_${s.i}@qdate.test`;
    const photos = [s.photo, s.photo, s.photo, s.photo]; // 4 required; same real face
    const user = await UserModel.create({
      email,
      name: s.name,
      age: s.age,
      authMethod: 'email',
      gender: s.gender,
      attraction: s.attraction,
      photoUrl: s.photo,
      photos,
      bio: `${s.name} — real-face test profile`,
      passwordHash,
      profile: {
        intent: INTENTS[s.i % INTENTS.length],
        sharedIntellectImportance: 1 + (s.i % 5),
        commStyle: COMMS[s.i % COMMS.length],
      },
      interestTags: INTEREST_SETS[s.i % INTEREST_SETS.length],
      guidelinesAcceptedVersion: '1.0',
      guidelinesAcceptedAt: new Date(),
    });

    const emb = await updateUserFaceEmbedding(String(user._id), photos);
    if (emb) embedded += 1;
    console.log(`  ${email.padEnd(26)} ${s.gender}/${s.attraction}  face=${emb ? emb.length + 'd' : 'NONE'}`);
  }

  console.log(`\n[faces] done. ${embedded}/${specs.length} got a face embedding. Password: ${PASSWORD}`);
  await disconnectFromDb();
}

main().catch(async (e) => {
  console.error('[faces] failed', e);
  await disconnectFromDb().catch(() => {});
  process.exit(1);
});
