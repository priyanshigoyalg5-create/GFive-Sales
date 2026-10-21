import { handleMetaWebhook, type MetaWebhookBody } from '@/lib/social/handler';
import { ownIds, privateReply, profileName, publicReply, sendDM, sendDMImage } from '@/lib/social/graph';
import { adminStore } from '@/lib/whatsapp/store-admin';
import { hasAdminCredentials } from '@/lib/server/firebase-admin';
import { validSignature } from '@/lib/whatsapp/signature';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Meta webhook for the Facebook Page + Instagram (DMs and comments). */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const want = process.env.META_VERIFY_TOKEN;
  const ok = q.get('hub.mode') === 'subscribe' && !!want && q.get('hub.verify_token') === want;
  return ok ? new Response(q.get('hub.challenge') || '', { status: 200 }) : new Response('Forbidden', { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.META_APP_SECRET || process.env.WA_APP_SECRET;
  if (!validSignature(raw, req.headers.get('x-hub-signature-256'), secret)) return new Response('Unauthorized', { status: 401 });
  if (!hasAdminCredentials()) return new Response('OK', { status: 200 });
  let body: MetaWebhookBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get('host')}`;
  await handleMetaWebhook(body, {
    store: adminStore(),
    api: { sendDM, sendDMImage, privateReply, publicReply, profileName },
    siteUrl: site,
    ownIds: ownIds(),
  }).catch((e) => console.error('meta webhook', e));
  return new Response('OK', { status: 200 });
}
