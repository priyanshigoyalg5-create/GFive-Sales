import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);

// Auth is created lazily so that public pages (and server prerendering)
// never touch Firebase Auth.
let _auth: Auth | null = null;
export function getAppAuth(): Auth {
  if (!_auth) _auth = getAuth(app);
  return _auth;
}

/**
 * A second Firebase app instance used only by the Super Admin to create new
 * staff accounts. Creating a user on the primary auth instance would sign the
 * super admin out, so we do it on this throw-away instance instead.
 */
export function getSecondaryApp(): FirebaseApp {
  const existing = getApps().find((a) => a.name === 'staff-creator');
  return existing ?? initializeApp(firebaseConfig, 'staff-creator');
}
