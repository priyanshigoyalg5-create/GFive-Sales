import { handle } from '@/lib/whatsapp/bot';
import { sendWati, watiToIncoming, type WatiEvent } from '@/lib/whatsapp/wati';
import { adminStore } from '@/lib/whatsapp/store-admin';
import { hasAdminCredentials } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * WATI webhook (WATI → Webhooks → "Message Received", URL …/api/whatsapp/wati?key=WATI_WEBHOOK_KEY).
 * WATI does not sign webhooks, so the secret key in the URL is checked instead.
 */
export async function POST(req: Request) {
  const key = new URL(req.url).searchParams.get('key') || req.headers.get('x-webhook-key') || '';
  if (!process.env.WATI_WEBHOOK_KEY || key !== process.env.WATI_WEBHOOK_KEY) return new Response('Unauthorized', { status: 401 });
  if (!hasAdminCredentials()) return new Response('OK', { status: 200 });
  let body: WatiEvent | WatiEvent[];
  try {
    body = await req.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const store = adminStore();
  const cfg = await store.getConfig();
  if (cfg.provider !== 'wati') return new Response('OK', { status: 200 }); // bot set to Meta direct
  const site = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get('host')}`;
  for (const e of Array.isArray(body) ? body : [body]) {
    const m = watiToIncoming(e);
    if (!m) continue;
    await handle(m.msg, m.name, { store, send: sendWati, siteUrl: site }).catch((err) => console.error('wati bot error', err));
  }
  return new Response('OK', { status: 200 });
}
