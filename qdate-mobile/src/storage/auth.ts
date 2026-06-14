import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthMethod } from '../navigation/RootNavigator';
import { IntentProfile, Phase } from '../types';

const KEY = 'qdate.user.v2';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  age: number;
  authMethod: AuthMethod;
  photoUrl: string | null;
  gender: 'man' | 'woman' | null;
  attraction: 'men' | 'women' | 'both' | null;
  profile: IntentProfile;
  currentPhase: Phase;
  registeredAt: string;
}

export async function loadUser(): Promise<StoredUser | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredUser>;
    if (!parsed.id) return null; // pre-v2 record without an id — force re-auth
    return {
      id: parsed.id,
      name: parsed.name ?? '',
      email: parsed.email ?? '',
      age: parsed.age ?? 0,
      authMethod: parsed.authMethod ?? 'email',
      photoUrl: parsed.photoUrl ?? null,
      gender: parsed.gender ?? null,
      attraction: parsed.attraction ?? null,
      profile: parsed.profile ?? {
        intent: 'long_term',
        sharedIntellectImportance: 3,
        commStyle: 'texting_first',
      },
      currentPhase: parsed.currentPhase ?? 'phase_1',
      registeredAt: parsed.registeredAt ?? new Date().toISOString(),
    };
  } catch (e) {
    console.warn('Failed to load user from storage', e);
    return null;
  }
}

export async function saveUser(user: StoredUser): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(user));
}

export async function clearUser(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
