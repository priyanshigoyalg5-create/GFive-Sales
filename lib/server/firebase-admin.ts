import 'server-only';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * Server-side Firestore with full access (bypasses security rules) — used only by
 * the WhatsApp / Instagram webhooks, which have no signed-in user.
 *
 * Needs FIREBASE_SERVICE_ACCOUNT on Vercel: the JSON from Firebase Console →
 * Project settings → Service accounts → Generate new private key (paste the whole
 * file, or its base64). Never commit it, never NEXT_PUBLIC_.
 */
let app: App | null = null;

export function hasAdminCredentials(): boolean {
  return !!process.env.FIREBASE_SERVICE_ACCOUNT;
}

export function adminDb(): Firestore {
  if (!app) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT || '';
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
    const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const sa = JSON.parse(json) as { project_id: string; client_email: string; private_key: string };
    app =
      getApps().find((a) => a.name === 'gfive-admin') ||
      initializeApp(
        { credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key.replace(/\\n/g, '\n') }) },
        'gfive-admin',
      );
  }
  return getFirestore(app);
}
