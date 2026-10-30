import 'server-only';
import { JW_BOOT, type JwUser } from '../jobwork';

/**
 * Checks that a request comes from a registered Job Work user. Like verify-staff.ts it reads
 * jw_users/<phone> through the Firestore REST API with the user's own ID token, so Google
 * validates the token and the security rules decide access. No service account needed.
 */
export async function verifyJwUser(idToken: string | null): Promise<JwUser | null> {
  if (!idToken) return null;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  let phone = '';
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
    phone = String(payload.phone_number || '');
    if (payload.aud !== projectId || (payload.exp && payload.exp * 1000 < Date.now())) return null;
  } catch {
    return null;
  }
  if (!/^\+\d{8,15}$/.test(phone)) return null;
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/jw_users/${encodeURIComponent(phone)}`, {
    headers: { Authorization: `Bearer ${idToken}` },
    cache: 'no-store',
  });
  const boot = JW_BOOT.includes(phone);
  if (res.status === 401 || res.status === 403) return null; // token not accepted by Google
  if (!res.ok && !(boot && res.status === 404)) return null;
  const doc = res.ok ? await res.json() : { fields: {} };
  const f = doc.fields || {};
  const perms: Record<string, unknown> = {};
  for (const [k, v] of Object.entries((f.perms?.mapValue?.fields || {}) as Record<string, { booleanValue?: boolean; integerValue?: string }>)) {
    perms[k] = v.booleanValue === true || Number(v.integerValue || 0) > 0;
  }
  return { phone, name: f.name?.stringValue || '', role: boot ? 'super' : f.role?.stringValue || 'staff', perms };
}

export const bearer = (req: Request) => req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
