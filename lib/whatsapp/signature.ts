import crypto from 'node:crypto';

/** Meta signs every webhook POST with the app secret (x-hub-signature-256). */
export function validSignature(raw: string, header: string | null, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith('sha256=')) return false;
  const want = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(header);
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

