export type CalibrationTag =
  | 'active_lifestyle'
  | 'creative_arts'
  | 'intellectual_curiosity'
  | 'social_energy'
  | 'homebody_rhythm'
  | 'outdoor_energy'
  | 'mindful_service'
  | 'adventure'
  | 'polished_style'
  | 'natural_style'
  | 'playful_energy'
  | 'minimalist_style'
  | 'expressive_style'
  | 'confident_presence';

export type InterestCalibrationCard = {
  id: string;
  icon: string;
  label: string;
  description: string;
  tags: CalibrationTag[];
};

export type LookCalibrationCard = {
  id: string;
  photoUrl: string;
  name: string;
  age: number;
  tags: CalibrationTag[];
};

// "Scale profiles" calibration library: each card has explicit tags that map
// to preference-vector axes.
export const INTEREST_CALIBRATION_DECK: InterestCalibrationCard[] = [
  { id: 'int_01', icon: '🏃', label: 'Marathon running', description: 'Trains 4x a week, recently ran NYC', tags: ['active_lifestyle', 'adventure'] },
  { id: 'int_02', icon: '🏺', label: 'Pottery & ceramics', description: 'Wheel-throwing on weekends', tags: ['creative_arts', 'homebody_rhythm'] },
  { id: 'int_03', icon: '📚', label: 'Literary fiction', description: 'Reads everything by Sally Rooney and Murakami', tags: ['intellectual_curiosity', 'homebody_rhythm'] },
  { id: 'int_04', icon: '🎷', label: 'Live jazz nights', description: 'Knows the city\'s underground venues', tags: ['social_energy', 'creative_arts'] },
  { id: 'int_05', icon: '🥾', label: 'Weekend hiking', description: 'Has a goal to summit one new peak a month', tags: ['outdoor_energy', 'adventure'] },
  { id: 'int_06', icon: '🍳', label: 'Cooking from scratch', description: 'Bakes sourdough every Sunday', tags: ['homebody_rhythm', 'creative_arts'] },
  { id: 'int_07', icon: '🎲', label: 'Board game nights', description: 'Hosts strategy night every other Friday', tags: ['social_energy', 'intellectual_curiosity'] },
  { id: 'int_08', icon: '💃', label: 'Salsa dancing', description: 'Started taking lessons six months ago', tags: ['social_energy', 'active_lifestyle'] },
  { id: 'int_09', icon: '🎨', label: 'Painting & galleries', description: 'Tries to see one new exhibition a month', tags: ['creative_arts', 'intellectual_curiosity'] },
  { id: 'int_10', icon: '🧗', label: 'Bouldering', description: 'V4 climber, prefers indoor walls', tags: ['active_lifestyle', 'adventure'] },
  { id: 'int_11', icon: '🎬', label: 'Arthouse cinema', description: 'Letterboxd four-star average', tags: ['creative_arts', 'intellectual_curiosity'] },
  { id: 'int_12', icon: '🤝', label: 'Volunteering', description: 'Spends Saturday mornings at the food bank', tags: ['mindful_service', 'social_energy'] },
];

export const LOOK_CALIBRATION_DECK: LookCalibrationCard[] = [
  { id: 'look_01', photoUrl: 'https://i.pravatar.cc/600?img=49', name: 'Sophie', age: 27, tags: ['natural_style', 'playful_energy'] },
  { id: 'look_02', photoUrl: 'https://i.pravatar.cc/600?img=44', name: 'Hannah', age: 30, tags: ['polished_style', 'confident_presence'] },
  { id: 'look_03', photoUrl: 'https://i.pravatar.cc/600?img=47', name: 'Aria', age: 26, tags: ['expressive_style', 'creative_arts'] },
  { id: 'look_04', photoUrl: 'https://i.pravatar.cc/600?img=45', name: 'Naomi', age: 32, tags: ['polished_style', 'minimalist_style'] },
  { id: 'look_05', photoUrl: 'https://i.pravatar.cc/600?img=48', name: 'Iris', age: 29, tags: ['natural_style', 'outdoor_energy'] },
  { id: 'look_06', photoUrl: 'https://i.pravatar.cc/600?img=23', name: 'Ben', age: 28, tags: ['playful_energy', 'active_lifestyle'] },
  { id: 'look_07', photoUrl: 'https://i.pravatar.cc/600?img=12', name: 'Daniel', age: 31, tags: ['minimalist_style', 'confident_presence'] },
  { id: 'look_08', photoUrl: 'https://i.pravatar.cc/600?img=14', name: 'Marco', age: 29, tags: ['polished_style', 'social_energy'] },
  { id: 'look_09', photoUrl: 'https://i.pravatar.cc/600?img=33', name: 'Tom', age: 27, tags: ['natural_style', 'outdoor_energy'] },
  { id: 'look_10', photoUrl: 'https://i.pravatar.cc/600?img=68', name: 'Alex', age: 33, tags: ['expressive_style', 'confident_presence'] },
];

export const CARD_TAGS_BY_ID: Record<string, CalibrationTag[]> = {
  ...Object.fromEntries(INTEREST_CALIBRATION_DECK.map((c) => [c.id, c.tags])),
  ...Object.fromEntries(LOOK_CALIBRATION_DECK.map((c) => [c.id, c.tags])),
};
