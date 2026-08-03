import { Types } from 'mongoose';
import { SwipeModel } from '../models/Swipe';
import { UserDoc, UserModel } from '../models/User';
import { notBlockedQuery } from './moderation';

// Calibration decks are now built from REAL profiles instead of a static demo
// library:
//   - 'interests' cards show a profile's bio + their selected interest tags
//     (no photo, no name) so the user calibrates on activities/lifestyle.
//   - 'looks' cards show a profile's photos (no name, no bio) so the user
//     calibrates on appearance.
// Each card's `id` is the profile's user id; recordSwipe stores that id, and the
// ML preference vectors (src/ml/features.ts) resolve it back to that user's tags.

export type InterestProfileCard = {
  id: string;
  bio: string;
  tags: string[];
};

export type LookProfileCard = {
  id: string;
  photoUrl: string;
  photos: string[];
  tags: string[];
};

// Face-descriptor length from the pretrained recognition net (see ml/faceEmbedding).
// A profile whose faceEmbedding has this many elements had a face successfully
// recognized in their photo; an empty array (or missing) means no face was found.
const FACE_EMBEDDING_DIM = 128;

/** Does someone with this `attraction` want to be shown this `gender`? */
function attractedTo(
  attraction: string | null | undefined,
  gender: string | null | undefined
): boolean {
  if (!attraction || attraction === 'both') return true;
  if (attraction === 'men') return gender === 'man';
  if (attraction === 'women') return gender === 'woman';
  return true;
}

/** Other users this requester could plausibly date (one-directional attraction). */
async function eligibleProfiles(userId: string | Types.ObjectId): Promise<UserDoc[]> {
  const me = await UserModel.findById(userId);
  if (!me) return [];
  const pref = (me.get('agePreference') as { min?: number; max?: number } | undefined) ?? {};
  const min = pref.min ?? 18;
  const max = pref.max ?? 99;
  // Never calibrate on banned/suspended accounts.
  const others = await UserModel.find({ _id: { $ne: me._id }, ...notBlockedQuery() });
  // Calibrate only on people you'd date — right gender and inside your age range.
  return others.filter((c) => attractedTo(me.attraction, c.gender) && c.age >= min && c.age <= max);
}

/** Cards the user hasn't swiped on yet come first; already-seen ones trail. */
function orderUnseenFirst<T extends { id: string }>(cards: T[], seen: Set<string>): T[] {
  const unseen = cards.filter((c) => !seen.has(c.id));
  const already = cards.filter((c) => seen.has(c.id));
  return [...unseen, ...already];
}

export async function getInterestCalibrationDeck(
  userId: string | Types.ObjectId
): Promise<InterestProfileCard[]> {
  const [profiles, seen] = await Promise.all([
    eligibleProfiles(userId),
    SwipeModel.distinct('cardId', { userId, mode: 'interests' }),
  ]);

  const cards: InterestProfileCard[] = profiles
    .filter((p) => ((p.get('interestTags') as string[] | undefined) ?? []).length > 0)
    .map((p) => ({
      id: String(p._id),
      bio: (p.get('bio') as string | undefined)?.trim() || '',
      tags: (p.get('interestTags') as string[] | undefined) ?? [],
    }));

  return orderUnseenFirst(cards, new Set(seen));
}

export async function getLookCalibrationDeck(
  userId: string | Types.ObjectId
): Promise<LookProfileCard[]> {
  const [profiles, seen] = await Promise.all([
    eligibleProfiles(userId),
    SwipeModel.distinct('cardId', { userId, mode: 'looks' }),
  ]);

  // Looks calibration is about FACES — only show people whose photo actually had
  // a recognizable face (a full-length face embedding). Placeholder / no-face
  // photos are excluded. (faceEmbedding is select:false but still queryable.)
  const withFace = await UserModel.find({
    _id: { $in: profiles.map((p) => p._id) },
    faceEmbedding: { $size: FACE_EMBEDDING_DIM },
  }).select('_id');
  const faceIds = new Set(withFace.map((u) => String(u._id)));

  const cards: LookProfileCard[] = profiles
    .filter((p) => faceIds.has(String(p._id)))
    .map((p) => {
      const photos = (p.get('photos') as string[] | undefined) ?? [];
      const primary = photos[0] ?? (p.get('photoUrl') as string | null | undefined) ?? null;
      return { profile: p, photos, primary };
    })
    .filter((x): x is { profile: UserDoc; photos: string[]; primary: string } => !!x.primary)
    .map(({ profile, photos, primary }) => ({
      id: String(profile._id),
      photoUrl: primary,
      photos: photos.length > 0 ? photos : [primary],
      tags: (profile.get('appearanceTags') as string[] | undefined) ?? [],
    }));

  return orderUnseenFirst(cards, new Set(seen));
}
