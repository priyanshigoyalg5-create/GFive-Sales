/**
 * Server-side check that a request comes from an active GFive staff member.
 * Reads staff/<uid> through the Firestore REST API *with the user's own
 * Firebase ID token*, so Google validates the token and the security rules
 * decide access. No service-account key is needed.
 */
export interface VerifiedStaff {
  uid: string;
  name: string;
  role: string;
  permissions: Record<string, boolean>;
}

export async function verifyStaff(idToken: string | null): Promise<VerifiedStaff | null> {
  if (!idToken) return null;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  let uid = '';
  let tokenEmail = '';
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
    uid = payload.user_id || payload.sub || '';
    tokenEmail = String(payload.email || '').toLowerCase();
    if (payload.aud !== projectId || (payload.exp && payload.exp * 1000 < Date.now())) return null;
  } catch {
    return null;
  }
  if (!/^[A-Za-z0-9]+$/.test(uid)) return null;
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/staff/${uid}`, {
    headers: { Authorization: `Bearer ${idToken}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const doc = await res.json();
  const f = doc.fields || {};
  if (f.active?.booleanValue === false) return null;
  const permissions: Record<string, boolean> = {};
  for (const [k, v] of Object.entries((f.permissions?.mapValue?.fields || {}) as Record<string, { booleanValue?: boolean }>)) {
    permissions[k] = v.booleanValue === true;
  }
  const email = tokenEmail; // from the Google-verified token
  const boot = (process.env.NEXT_PUBLIC_SUPERADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const role = boot.includes(email) ? 'superadmin' : f.role?.stringValue || 'admin';
  return { uid, name: f.name?.stringValue || '', role, permissions };
}
