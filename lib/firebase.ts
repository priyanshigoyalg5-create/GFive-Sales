import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence, type Auth } from 'firebase/auth';

import { app, firebaseConfig } from './firebase-app';

export { firebaseConfig };

export const db = getFirestore(app);

// Auth is created lazily so that server prerendering never touches it.
// initializeAuth (instead of getAuth) leaves out the Google-popup/redirect code
// we never use, which keeps the staff pages' JavaScript smaller.
let _auth: Auth | null = null;
export function getAppAuth(): Auth {
  if (!_auth) _auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
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

let _secAuth: Auth | null = null;
/** Auth on the secondary app — never remembered on this device. */
export function getSecondaryAuth(): Auth {
  if (!_secAuth) _secAuth = initializeAuth(getSecondaryApp(), { persistence: inMemoryPersistence });
  return _secAuth;
}
