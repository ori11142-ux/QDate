import React, { createContext, useContext, useEffect, useState } from 'react';

import { api, BackendUser } from '../api';
import { clearUser, loadUser, saveUser, StoredUser } from '../storage/auth';
import { Phase } from '../types';

export type RegisterInput = {
  name: string;
  email: string;
  age: number;
  authMethod: 'email' | 'apple';
  password: string;
  photoUrl?: string | null;
  gender?: 'man' | 'woman' | null;
  attraction?: 'men' | 'women' | 'both' | null;
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
  signOut: () => Promise<void>;
  togglePhase: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function backendUserToStored(u: BackendUser): StoredUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    age: u.age,
    authMethod: u.authMethod,
    photoUrl: u.photoUrl ?? null,
    gender: u.gender ?? null,
    attraction: u.attraction ?? null,
    profile: u.profile,
    currentPhase: u.currentPhase,
    registeredAt: u.createdAt,
  };
}

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

  async function signOut() {
    await clearUser();
    setUser(null);
  }

  // Demo-only: flips phase locally so you can show Phase 2 without waiting 14 days.
  // Does not touch the backend.
  async function togglePhase() {
    if (!user) return;
    const nextPhase: Phase = user.currentPhase === 'phase_1' ? 'phase_2' : 'phase_1';
    const updated: StoredUser = { ...user, currentPhase: nextPhase };
    await saveUser(updated);
    setUser(updated);
  }

  return (
    <AuthContext.Provider
      value={{ user, isHydrating, register, login, signOut, togglePhase }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
