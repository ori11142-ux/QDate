import { ChatMessage, InsightsSummary, InterestCard, LookCard, Match } from './types';

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
  { id: 'look_01', photoUrl: 'https://i.pravatar.cc/600?img=49', name: 'Sophie', age: 27 },
  { id: 'look_02', photoUrl: 'https://i.pravatar.cc/600?img=44', name: 'Hannah', age: 30 },
  { id: 'look_03', photoUrl: 'https://i.pravatar.cc/600?img=47', name: 'Aria', age: 26 },
  { id: 'look_04', photoUrl: 'https://i.pravatar.cc/600?img=45', name: 'Naomi', age: 32 },
  { id: 'look_05', photoUrl: 'https://i.pravatar.cc/600?img=48', name: 'Iris', age: 29 },
  { id: 'look_06', photoUrl: 'https://i.pravatar.cc/600?img=23', name: 'Ben', age: 28 },
  { id: 'look_07', photoUrl: 'https://i.pravatar.cc/600?img=12', name: 'Daniel', age: 31 },
  { id: 'look_08', photoUrl: 'https://i.pravatar.cc/600?img=14', name: 'Marco', age: 29 },
  { id: 'look_09', photoUrl: 'https://i.pravatar.cc/600?img=33', name: 'Tom', age: 27 },
  { id: 'look_10', photoUrl: 'https://i.pravatar.cc/600?img=68', name: 'Alex', age: 33 },
];
