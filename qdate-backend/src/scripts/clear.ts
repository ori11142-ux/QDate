/**
 * Delete ALL users, matches, messages, and swipes — without creating anything.
 *
 *   npm run clear
 *
 * Use this to wipe every account you've created. (Running `npm run seed`
 * also wipes first, then recreates the test batch.)
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectToDb, disconnectFromDb } from '../config/db';
import { UserModel } from '../models/User';
import { MatchModel } from '../models/Match';
import { MessageModel } from '../models/Message';
import { SwipeModel } from '../models/Swipe';
import { FeedbackModel } from '../models/Feedback';
import { MessageEventModel } from '../models/MessageEvent';

async function main() {
  await connectToDb();

  console.log('[clear] wiping all collections…');
  const [u, m, msg, s, f, me] = await Promise.all([
    UserModel.deleteMany({}),
    MatchModel.deleteMany({}),
    MessageModel.deleteMany({}),
    SwipeModel.deleteMany({}),
    FeedbackModel.deleteMany({}),
    MessageEventModel.deleteMany({}),
  ]);

  console.log(
    `[clear] deleted ${u.deletedCount} users, ${m.deletedCount} matches, ` +
      `${msg.deletedCount} messages, ${s.deletedCount} swipes, ` +
      `${f.deletedCount} feedback entries, ${me.deletedCount} message events.`
  );

  await disconnectFromDb();
}

main().catch(async (err) => {
  console.error('[clear] failed', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
