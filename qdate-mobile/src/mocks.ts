import { ChatMessage, InsightsSummary, InterestCard, LookCard, Match } from './types';

// Generates a self-labeling look-card placeholder as a PNG URL that React
// Native's <Image> can render without SVG dependencies.
function mockLookPhoto(tags: string[]): string {
  const label = encodeURIComponent(tags.join(' · '));
  return `https://placehold.co/600x600.png?text=${label}`;
}

const dailyExpires = new Date(
  Date.now() + 16 * 60 * 60 * 1000 + 45 * 60 * 1000 + 12 * 1000
);

export const mockMatch: Match = {
  matchId: 'm_001',
  candidateName: 'Olivia',
  candidateAge: 29,
  candidateBio: 'Coffee enthusiast, loves indie films',
  expiresAt: dailyExpires.toISOString(),
  dayInLearningPeriod: 3,
  totalLearningDays: 14,
};

const weeklyExpires = new Date(
  Date.now() + 6 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000
);

export const mockWeeklyMatch: Match = {
  matchId: 'wk_001',
  candidateName: 'Maya',
  candidateAge: 31,
  candidateBio:
    'Architect, weekend hiker, writes fiction on the side. Looking for someone who reads.',
  expiresAt: weeklyExpires.toISOString(),
  isIntentionalPairing: true,
  cooldownActive: false,
};

export const mockInsights: InsightsSummary = {
  intentScore: 7.5,
  avgReplyTimeHours: 2.1,
  messagesSentLast7Days: 13,
  totalMessages: 48,
  matchOutcomes: {
    connected: 2,
    skipped: 3,
    expired: 1,
    pendingOrActive: 1,
  },
  calibration: { interests: 0.45, looks: 0.6 },
  reflections: [
    {
      matchId: 'm_old_01',
      name: 'Sarah',
      age: 30,
      reason: 'You skipped this match - what felt off?',
    },
  ],
};

export const mockSeedMessages: ChatMessage[] = [
  {
    id: 'msg_seed_1',
    matchId: 'm_001',
    text: 'Hey! I saw you also like indie films. Have you watched anything good lately?',
    sentAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
    fromMe: false,
  },
];

export const mockReplyPool = [
  'That\'s really interesting, tell me more',
  'Haha I love that. What got you into it?',
  'Same here actually — small world',
  'Honestly I\'ve been thinking about that too',
  'You have good taste',
];

// Calibration decks. By design these are NOT linked to each other:
// the people behind look cards have no overlap with interest cards.
// Mode independence is enforced at the data layer.

export const mockInterestDeck: InterestCard[] = [
  { id: 'int_01', icon: '🏃', label: 'Marathon running', description: 'Trains 4x a week, recently ran NYC' },
  { id: 'int_02', icon: '🏺', label: 'Pottery & ceramics', description: 'Wheel-throwing on weekends' },
  { id: 'int_03', icon: '📚', label: 'Literary fiction', description: 'Reads everything by Sally Rooney and Murakami' },
  { id: 'int_04', icon: '🎷', label: 'Live jazz nights', description: 'Knows the city\'s underground venues' },
  { id: 'int_05', icon: '🥾', label: 'Weekend hiking', description: 'Has a goal to summit one new peak a month' },
  { id: 'int_06', icon: '🍳', label: 'Cooking from scratch', description: 'Bakes sourdough every Sunday' },
  { id: 'int_07', icon: '🎲', label: 'Board game nights', description: 'Hosts strategy night every other Friday' },
  { id: 'int_08', icon: '💃', label: 'Salsa dancing', description: 'Started taking lessons six months ago' },
  { id: 'int_09', icon: '🎨', label: 'Painting & galleries', description: 'Tries to see one new exhibition a month' },
  { id: 'int_10', icon: '🧗', label: 'Bouldering', description: 'V4 climber, prefers indoor walls' },
  { id: 'int_11', icon: '🎬', label: 'Arthouse cinema', description: 'Letterboxd four-star average' },
  { id: 'int_12', icon: '🤝', label: 'Volunteering', description: 'Spends Saturday mornings at the food bank' },
];

export const mockLookDeck: LookCard[] = [
  { id: 'look_01', name: 'Sophie', age: 27, tags: ['blonde', 'slim_build', 'light_skin'],                photoUrl: mockLookPhoto(['blonde', 'slim_build', 'light_skin']) },
  { id: 'look_02', name: 'Hannah', age: 30, tags: ['dark_hair', 'athletic_build', 'medium_skin'],        photoUrl: mockLookPhoto(['dark_hair', 'athletic_build', 'medium_skin']) },
  { id: 'look_03', name: 'Aria',   age: 26, tags: ['red_hair', 'curvy_build', 'light_skin'],             photoUrl: mockLookPhoto(['red_hair', 'curvy_build', 'light_skin']) },
  { id: 'look_04', name: 'Naomi',  age: 32, tags: ['dark_skin', 'slim_build', 'clean_cut'],              photoUrl: mockLookPhoto(['dark_skin', 'slim_build', 'clean_cut']) },
  { id: 'look_05', name: 'Iris',   age: 29, tags: ['light_brown_hair', 'athletic_build', 'medium_skin'], photoUrl: mockLookPhoto(['light_brown_hair', 'athletic_build', 'medium_skin']) },
  { id: 'look_06', name: 'Ben',    age: 28, tags: ['blonde', 'full_build', 'light_skin'],                photoUrl: mockLookPhoto(['blonde', 'full_build', 'light_skin']) },
  { id: 'look_07', name: 'Daniel', age: 31, tags: ['dark_hair', 'tall', 'clean_cut'],                    photoUrl: mockLookPhoto(['dark_hair', 'tall', 'clean_cut']) },
  { id: 'look_08', name: 'Marco',  age: 29, tags: ['dark_skin', 'athletic_build', 'edgy_look'],          photoUrl: mockLookPhoto(['dark_skin', 'athletic_build', 'edgy_look']) },
  { id: 'look_09', name: 'Tom',    age: 27, tags: ['light_brown_hair', 'short', 'medium_skin'],          photoUrl: mockLookPhoto(['light_brown_hair', 'short', 'medium_skin']) },
  { id: 'look_10', name: 'Alex',   age: 33, tags: ['red_hair', 'slim_build', 'edgy_look'],               photoUrl: mockLookPhoto(['red_hair', 'slim_build', 'edgy_look']) },
];
