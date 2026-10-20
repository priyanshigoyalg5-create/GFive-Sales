import { handle, type Incoming } from '@/lib/whatsapp/bot';
import { send } from '@/lib/whatsapp/client';
import { adminStore } from '@/lib/whatsapp/store-admin';
import { hasAdminCredentials } from '@/lib/server/firebase-admin';
import { validSignature } from '@/lib/whatsapp/signature';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Meta webhook for the WhatsApp bot.
 * GET  = one-time verification (hub.verify_token must equal WA_VERIFY_TOKEN)
 * POST = incoming messages; signature checked with WA_APP_SECRET.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const ok = q.get('hub.mode') === 'subscribe' && !!process.env.WA_VERIFY_TOKEN && q.get('hub.verify_token') === process.env.WA_VERIFY_TOKEN;
  return ok ? new Response(q.get('hub.challenge') || '', { status: 200 }) : new Response('Forbidden', { status: 403 });
}

interface Change {
  field?: string;
  value?: { messages?: Incoming[]; contacts?: { wa_id: string; profile?: { name?: string } }[] };
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get('x-hub-signature-256'), process.env.WA_APP_SECRET)) {
    console.warn('whatsapp webhook: bad signature');
    return new Response('Unauthorized', { status: 401 });
  }
  if (!hasAdminCredentials()) {
    console.error('whatsapp webhook: FIREBASE_SERVICE_ACCOUNT missing');
    return new Response('OK', { status: 200 }); // don't make Meta retry forever
  }
  let body: { entry?: { changes?: Change[] }[] } = {};
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const store = adminStore();
  const site = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get('host')}`;
  const chains: Record<string, Promise<void>> = {};
  for (const entry of body.entry || []) {
    for (const ch of entry.changes || []) {
      if (ch.field !== 'messages') continue;
      const contacts = ch.value?.contacts || [];
      for (const m of ch.value?.messages || []) {
        if ((m as { group_id?: string }).group_id) continue;
        const name = contacts.find((c) => c.wa_id === m.from)?.profile?.name || '';
        // one person's messages are handled in order
        chains[m.from] = (chains[m.from] || Promise.resolve())
          .then(() => handle(m, name, { store, send, siteUrl: site }))
          .catch((e) => console.error('whatsapp bot error', e));
      }
    }
  }
  await Promise.all(Object.values(chains));
  return new Response('OK', { status: 200 });
}
