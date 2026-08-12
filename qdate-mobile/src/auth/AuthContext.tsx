// Auth state for the whole app: holds the current user, restores a saved session
// on launch, and exposes register/login/logout/profile helpers via useAuth().
import React, { createContext, useContext, useEffect, useState } from 'react';

import { api, BackendUser, ProfileUpdatePayload } from '../api';
import { clearUser, loadUser, saveUser, StoredUser } from '../storage/auth';
import { Phase } from '../types';

export type RegisterInput = {
  name: string;
  email: string;
  age: number;
  authMethod: 'email' | 'apple' | 'google';
  password: string;
  photos: string[];
  bio?: string;
  interestTags?: string[];
  gender?: 'man' | 'woman' | null;
  attraction?: 'men' | 'women' | 'both' | null;
  agePreference: { min: number; max: number };
  guidelinesAccepted: boolean;
  guidelinesVersion: string;
  biometricConsent: boolean;
  profile: {
    intent: 'long_term' | 'casual' | 'explore' | 'friendship';
    sharedIntellectImportance: number;
    commStyle: 'texting_first' | 'voice_early' | 'meet_in_person';
  };
};

interface AuthContextValue {
  user: StoredUser | null;
  isHydrating: boolean;
  register: (input: RegisterInput) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  updateProfile: (updates: ProfileUpdatePayload) => Promise<void>;
  signOut: () => Promise<void>;
  syncPhase: (phase: Phase) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Convert the backend's user shape into the trimmed shape we keep on-device.
function backendUserToStored(u: BackendUser): StoredUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    age: u.age,
    authMethod: u.authMethod,
    photoUrl: u.photoUrl ?? null,
    photos: u.photos ?? (u.photoUrl ? [u.photoUrl] : []),
    bio: u.bio ?? '',
    gender: u.gender ?? null,
    attraction: u.attraction ?? null,
    agePreference: u.agePreference ?? { min: 18, max: 99 },
    profile: u.profile,
    interestTags: u.interestTags ?? [],
    currentPhase: u.currentPhase,
    registeredAt: u.createdAt,
  };
}

// Provides the auth context to the tree and keeps the user in sync with storage.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    let active = true;
    loadUser().then((stored) => {
      if (!active) return;
      setUser(stored);
      setIsHydrating(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // Throws on failure (email exists, network error) — callers handle the error.
  async function register(input: RegisterInput) {
    const backendUser = await api.register(input);
    const stored = backendUserToStored(backendUser);
    await saveUser(stored);
    setUser(stored);
  }

  // Throws on failure (invalid credentials, network error).
  async function login(email: string, password: string) {
    const backendUser = await api.login(email, password);
    const stored = backendUserToStored(backendUser);
    await saveUser(stored);
    setUser(stored);
  }

  // Persist profile edits to the backend, then mirror the canonical result
  // (with sanitized interestTags) into local storage and context.
  async function updateProfile(updates: ProfileUpdatePayload) {
    if (!user) return;
    const backendUser = await api.updateProfile(user.id, updates);
    const stored = backendUserToStored(backendUser);
    await saveUser(stored);
    setUser(stored);
  }

  async function signOut() {
    await clearUser();
    setUser(null);
  }

  // Sync local phase to the backend's truth — the server promotes a user to
  // phase 2 once their learning period ends and reports the phase on each match,
  // so the UI (and any phase-based logic) stays correct. No-op if unchanged.
  async function syncPhase(phase: Phase) {
    if (!user || user.currentPhase === phase) return;
    const updated: StoredUser = { ...user, currentPhase: phase };
    await saveUser(updated);
    setUser(updated);
  }

  return (
    <AuthContext.Provider
      value={{ user, isHydrating, register, login, updateProfile, signOut, syncPhase }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook screens use to read auth + call login/register/etc; errors if used
// outside an AuthProvider.
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
