/**
 * Wipe the database and seed a batch of test profiles you can log in as.
 *
 *   npm run seed
 *
 * Every profile shares the SAME password (printed at the end), so you can sign
 * in as any of them to test matching, chat (from both sides), and insights.
 */

import 'dotenv/config';
import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectToDb, disconnectFromDb } from '../config/db';
import { UserModel } from '../models/User';
import { MatchModel } from '../models/Match';
import { MessageModel } from '../models/Message';
import { SwipeModel } from '../models/Swipe';
import { FeedbackModel } from '../models/Feedback';
import { MessageEventModel } from '../models/MessageEvent';

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

const LOOK_TAG_SETS = [
  ['natural_style', 'playful_energy'],
  ['polished_style', 'confident_presence'],
  ['expressive_style', 'creative_arts'],
  ['minimalist_style', 'confident_presence'],
  ['outdoor_energy', 'natural_style'],
  ['active_lifestyle', 'playful_energy'],
];

const INTEREST_TAG_SETS = [
  ['intellectual_curiosity', 'homebody_rhythm'],
  ['social_energy', 'creative_arts'],
  ['active_lifestyle', 'adventure'],
  ['mindful_service', 'social_energy'],
  ['creative_arts', 'intellectual_curiosity'],
  ['outdoor_energy', 'active_lifestyle'],
];

function emailFor(name: string): string {
  // "Noah Bennett" -> "noah.bennett@qdate.test"
  return `${name.toLowerCase().replace(/\s+/g, '.')}@qdate.test`;
}

async function main() {
  await connectToDb();

  console.log('[seed] wiping all collections…');
  const [u, m, msg, s, f, me] = await Promise.all([
    UserModel.deleteMany({}),
    MatchModel.deleteMany({}),
    MessageModel.deleteMany({}),
    SwipeModel.deleteMany({}),
    FeedbackModel.deleteMany({}),
    MessageEventModel.deleteMany({}),
  ]);
  console.log(
    `[seed] removed ${u.deletedCount} users, ${m.deletedCount} matches, ` +
      `${msg.deletedCount} messages, ${s.deletedCount} swipes, ` +
      `${f.deletedCount} feedback entries, ${me.deletedCount} message events.`
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
    interestTags: INTEREST_TAG_SETS[p.img % INTEREST_TAG_SETS.length],
    appearanceTags: LOOK_TAG_SETS[p.img % LOOK_TAG_SETS.length],
  }));
  const users = await UserModel.insertMany(docs);

  // Create a few historical outcomes to train adaptive ranking weights.
  const byEmail = new Map(users.map((u) => [u.email, u]));
  const noah = byEmail.get(emailFor('Noah Bennett'));
  const maya = byEmail.get(emailFor('Maya Chen'));
  const adam = byEmail.get(emailFor('Adam Frost'));
  const tamar = byEmail.get(emailFor('Tamar Klein'));
  if (noah && maya && adam && tamar) {
    const convA = new Types.ObjectId().toString();
    const connectedA = await MatchModel.create({
      userId: noah._id,
      candidateUserId: maya._id,
      phase: 'phase_1',
      status: 'connected',
      conversationId: convA,
      expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      dayInLearningPeriod: 6,
    });
    await MatchModel.create({
      userId: maya._id,
      candidateUserId: noah._id,
      phase: 'phase_1',
      status: 'connected',
      conversationId: convA,
      expiresAt: connectedA.expiresAt,
      dayInLearningPeriod: 6,
    });

    await MessageModel.insertMany([
      {
        conversationId: convA,
        senderId: noah._id,
        text: 'Hey Maya, loved that you enjoy long form books.',
        messageLength: 48,
        responseTimeSeconds: null,
        sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        readAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 8 * 60 * 1000),
      },
      {
        conversationId: convA,
        senderId: maya._id,
        text: 'Same here — any recommendations?',
        messageLength: 33,
        responseTimeSeconds: 540,
        sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 12 * 60 * 1000),
        readAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 20 * 60 * 1000),
      },
    ]);

    await FeedbackModel.insertMany([
      { matchId: connectedA._id, userId: noah._id, willingnessToMeet: 5, communicationCompatibility: 5 },
      { matchId: connectedA._id, userId: maya._id, willingnessToMeet: 4, communicationCompatibility: 5 },
    ]);

    const convB = new Types.ObjectId().toString();
    await MatchModel.insertMany([
      {
        userId: adam._id,
        candidateUserId: tamar._id,
        phase: 'phase_1',
        status: 'skipped',
        conversationId: convB,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        dayInLearningPeriod: 5,
      },
      {
        userId: tamar._id,
        candidateUserId: adam._id,
        phase: 'phase_1',
        status: 'skipped',
        conversationId: convB,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        dayInLearningPeriod: 5,
      },
    ]);
  }

  // Seed calibration swipes and message events for the learning pipeline.
  const seedUser = users[0];
  if (seedUser) {
    await SwipeModel.insertMany([
      { userId: seedUser._id, cardId: 'int_03', mode: 'interests', liked: true, responseTimeMs: 1200, swipedAt: new Date() },
      { userId: seedUser._id, cardId: 'int_05', mode: 'interests', liked: true, responseTimeMs: 1600, swipedAt: new Date() },
      { userId: seedUser._id, cardId: 'int_02', mode: 'interests', liked: false, responseTimeMs: 900, swipedAt: new Date() },
      { userId: seedUser._id, cardId: 'look_02', mode: 'looks', liked: true, responseTimeMs: 700, swipedAt: new Date() },
      { userId: seedUser._id, cardId: 'look_07', mode: 'looks', liked: false, responseTimeMs: 950, swipedAt: new Date() },
    ]);
    await MessageEventModel.insertMany([
      { matchId: new Types.ObjectId(), senderId: seedUser._id, messageLength: 56, responseTimeSeconds: 480, recordedAt: new Date() },
      { matchId: new Types.ObjectId(), senderId: seedUser._id, messageLength: 34, responseTimeSeconds: 1300, recordedAt: new Date() },
    ]);
  }

  console.log('\n[seed] done. Log in with any of these:\n');
  for (const p of PROFILES) {
    console.log(
      `   ${emailFor(p.name).padEnd(30)}  ${p.gender.padEnd(6)} into ${p.attraction}`
    );
  }
  console.log(`\n   Password for ALL accounts:  ${PASSWORD}\n`);
  console.log({
    users: await UserModel.countDocuments(),
    matches: await MatchModel.countDocuments(),
    messages: await MessageModel.countDocuments(),
    swipes: await SwipeModel.countDocuments(),
    feedback: await FeedbackModel.countDocuments(),
    messageEvents: await MessageEventModel.countDocuments(),
  });

  await disconnectFromDb();
}

main().catch(async (err) => {
  console.error('[seed] failed', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
