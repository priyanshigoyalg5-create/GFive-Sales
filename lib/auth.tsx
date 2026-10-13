'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, getAppAuth } from './firebase';
import type { Role, StaffProfile } from './types';
import { syncPublicStaff } from './staff';

/** Comma separated list of e-mails that are always Super Admin (bootstrap). */
export const SUPERADMIN_EMAILS = (process.env.NEXT_PUBLIC_SUPERADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'no-access'; user: User; reason: string }
  | { status: 'ready'; user: User; profile: StaffProfile };

interface AuthCtx {
  state: AuthState;
  profile: StaffProfile | null;
  role: Role | null;
  isSuper: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

async function loadProfile(user: User): Promise<AuthState> {
  const ref = doc(db, 'staff', user.uid);
  const email = (user.email || '').toLowerCase();
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as Omit<StaffProfile, 'uid'>;
      if (data.active === false) {
        return { status: 'no-access', user, reason: 'Your account has been disabled. Please contact the Super Admin.' };
      }
      // Bootstrap emails are always super admin even if the doc says otherwise.
      const role: Role = SUPERADMIN_EMAILS.includes(email) ? 'superadmin' : data.role || 'admin';
      const profile: StaffProfile = { ...data, uid: user.uid, role, active: true };
      // make sure the public profile used by customer links exists
      syncPublicStaff({ uid: user.uid, name: profile.name, whatsappNumber: profile.whatsappNumber || '', active: true }).catch(() => {});
      return { status: 'ready', user, profile };
    }
    if (SUPERADMIN_EMAILS.includes(email)) {
      const profile: StaffProfile = {
        uid: user.uid,
        name: user.displayName || email.split('@')[0],
        email,
        role: 'superadmin',
        active: true,
      };
      await setDoc(ref, { ...profile, createdAt: serverTimestamp() });
      await syncPublicStaff({ uid: user.uid, name: profile.name, whatsappNumber: '', active: true }).catch(() => {});
      return { status: 'ready', user, profile };
    }
    return {
      status: 'no-access',
      user,
      reason: 'This account is not registered as GFive staff. Ask the Super Admin to add you from the Team page.',
    };
  } catch (err) {
    console.error('Failed to load staff profile', err);
    return {
      status: 'no-access',
      user,
      reason: 'Could not verify your access (check Firestore rules / internet). Please try again.',
    };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    const auth = getAppAuth();
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ status: 'signed-out' });
        return;
      }
      setState({ status: 'loading' });
      setState(await loadProfile(user));
    });
    return () => unsub();
  }, []);

  const value = useMemo<AuthCtx>(() => {
    const profile = state.status === 'ready' ? state.profile : null;
    return {
      state,
      profile,
      role: profile?.role ?? null,
      isSuper: profile?.role === 'superadmin',
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(getAppAuth(), email.trim(), password);
      },
      signOut: async () => {
        await fbSignOut(getAppAuth());
      },
      resetPassword: async (email) => {
        await sendPasswordResetEmail(getAppAuth(), email.trim());
      },
    };
  }, [state]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a minute and try again.';
    case 'auth/network-request-failed':
      return 'No internet connection.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in Firebase Console → Authentication.';
    default:
      return (err as Error)?.message || 'Something went wrong.';
  }
}
