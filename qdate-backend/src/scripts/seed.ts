/**
 * Wipe the database and seed a batch of test profiles you can log in as.
 *
 *   npm run seed
 *
 * Every profile shares the SAME password (printed at the end), so you can sign
 * in as any of them to test matching, chat (from both sides), and insights.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectToDb, disconnectFromDb } from '../config/db';
import { UserModel } from '../models/User';
import { MatchModel } from '../models/Match';
import { MessageModel } from '../models/Message';
import { SwipeModel } from '../models/Swipe';

// The shared login password for every seeded account.
const PASSWORD = 'qdate1234';

// 14 varied profiles. Genders/attractions are spread so a typical test account
// (a man into women, or a woman into men) has several mutual matches available.
const PROFILES = [
  // ── men ──────────────────────────────────────────────────────────────────
  { name: 'Noah Bennett',  age: 27, gender: 'man',   attraction: 'women', intent: 'long_term',  intellect: 5, comm: 'texting_first',  score: 7.2, img: 11 },
  { name: 'Itai Cohen',    age: 31, gender: 'man',   attraction: 'women', intent: 'casual',     intellect: 3, comm: 'voice_early',    score: 5.6, img: 13 },
  { name: 'Daniel Roth',   age: 24, gender: 'man',   attraction: 'both',  intent: 'explore',    intellect: 4, comm: 'meet_in_person', score: 6.1, img: 14 },
  { name: 'Adam Frost',    age: 35, gender: 'man',   attraction: 'women', intent: 'long_term',  intellect: 5, comm: 'texting_first',  score: 8.3, img: 15 },
  { name: 'Yonatan Levi',  age: 29, gender: 'man',   attraction: 'women', intent: 'friendship', intellect: 2, comm: 'voice_early',    score: 4.8, img: 51 },
  { name: 'Omer Katz',     age: 26, gender: 'man',   attraction: 'both',  intent: 'casual',     intellect: 4, comm: 'meet_in_person', score: 6.9, img: 52 },
  // ── women ────────────────────────────────────────────────────────────────
  { name: 'Maya Chen',     age: 28, gender: 'woman', attraction: 'men',   intent: 'long_term',  intellect: 5, comm: 'texting_first',  score: 8.0, img: 44 },
  { name: 'Noa Shapiro',   age: 25, gender: 'woman', attraction: 'both',  intent: 'casual',     intellect: 3, comm: 'voice_early',    score: 5.9, img: 45 },
  { name: 'Tamar Klein',   age: 33, gender: 'woman', attraction: 'men',   intent: 'long_term',  intellect: 5, comm: 'meet_in_person', score: 8.6, img: 47 },
  { name: 'Shira Avni',    age: 27, gender: 'woman', attraction: 'men',   intent: 'explore',    intellect: 4, comm: 'texting_first',  score: 6.4, img: 48 },
  { name: 'Yael Bar',      age: 30, gender: 'woman', attraction: 'both',  intent: 'long_term',  intellect: 4, comm: 'voice_early',    score: 7.5, img: 49 },
  { name: 'Olivia Park',   age: 29, gender: 'woman', attraction: 'men',   intent: 'casual',     intellect: 3, comm: 'texting_first',  score: 6.0, img: 26 },
  { name: 'Emma Wright',   age: 26, gender: 'woman', attraction: 'women', intent: 'long_term',  intellect: 5, comm: 'meet_in_person', score: 7.8, img: 31 },
  { name: 'Lior Mizrahi',  age: 32, gender: 'woman', attraction: 'men',   intent: 'friendship', intellect: 2, comm: 'voice_early',    score: 5.1, img: 32 },
] as const;

function emailFor(name: string): string {
  // "Noah Bennett" -> "noah.bennett@qdate.test"
  return `${name.toLowerCase().replace(/\s+/g, '.')}@qdate.test`;
}

async function main() {
  await connectToDb();

  console.log('[seed] wiping all collections…');
  const [u, m, msg, s] = await Promise.all([
    UserModel.deleteMany({}),
    MatchModel.deleteMany({}),
    MessageModel.deleteMany({}),
    SwipeModel.deleteMany({}),
  ]);
  console.log(
    `[seed] removed ${u.deletedCount} users, ${m.deletedCount} matches, ` +
      `${msg.deletedCount} messages, ${s.deletedCount} swipes.`
  );

  console.log(`[seed] hashing shared password…`);
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  console.log(`[seed] creating ${PROFILES.length} profiles…`);
  const docs = PROFILES.map((p) => ({
    email: emailFor(p.name),
    name: p.name,
    age: p.age,
    authMethod: 'email' as const,
    gender: p.gender,
    attraction: p.attraction,
    photoUrl: `https://i.pravatar.cc/400?img=${p.img}`,
    passwordHash,
    profile: {
      intent: p.intent,
      sharedIntellectImportance: p.intellect,
      commStyle: p.comm,
    },
    currentPhase: 'phase_1' as const,
    intentScore: p.score,
  }));
  await UserModel.insertMany(docs);

  console.log('\n[seed] done. Log in with any of these:\n');
  for (const p of PROFILES) {
    console.log(
      `   ${emailFor(p.name).padEnd(30)}  ${p.gender.padEnd(6)} into ${p.attraction}`
    );
  }
  console.log(`\n   Password for ALL accounts:  ${PASSWORD}\n`);
  console.log({ users: await UserModel.countDocuments() });

  await disconnectFromDb();
}

main().catch(async (err) => {
  console.error('[seed] failed', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
