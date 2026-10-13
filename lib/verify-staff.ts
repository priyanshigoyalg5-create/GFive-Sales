/**
 * Server-side check that a request comes from an active GFive staff member.
 * Reads staff/<uid> through the Firestore REST API *with the user's own
 * Firebase ID token*, so Google validates the token and the security rules
 * decide access. No service-account key is needed.
 */
export async function verifyStaff(idToken: string | null): Promise<{ uid: string; name: string; role: string } | null> {
  if (!idToken) return null;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  let uid = '';
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
    uid = payload.user_id || payload.sub || '';
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
  return { uid, name: f.name?.stringValue || '', role: f.role?.stringValue || 'admin' };
}
