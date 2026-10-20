import 'server-only';
import type { WaPayload } from './payloads';
import { asText, type Interactive } from './wati-format';
export { watiToIncoming, type WatiEvent } from './wati-format';

/**
 * WATI adapter — lets the same bot run on a number that is connected to WATI.
 * Env: WATI_API_ENDPOINT (from WATI → API Docs, e.g. https://live-mt-server.wati.io/123456),
 *      WATI_API_TOKEN (Bearer token from WATI → API Docs / Connector → API),
 *      WATI_WEBHOOK_KEY (any long secret word; also added to the webhook URL in WATI).
 *
 * Our bot builds messages in Meta's format; this file converts them to WATI's v1 API.
 * If WATI refuses a button/list message, the same options are sent as numbered text
 * ("1. Naye designs …") — customers can reply with the number.
 */
type Fetch = typeof fetch;
let fetchImpl: Fetch = (...a) => fetch(...a);
export function _setWatiFetch(f: Fetch) {
  fetchImpl = f;
}

function base() {
  const b = (process.env.WATI_API_ENDPOINT || '').replace(/\/$/, '');
  if (!b) throw new Error('WATI_API_ENDPOINT is not set');
  return b;
}

async function call(path: string, body?: unknown) {
  const token = (process.env.WATI_API_TOKEN || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('WATI_API_TOKEN is not set');
  const res = await fetchImpl(`${base()}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: { result?: boolean | string; ok?: boolean; info?: string } | null = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  // WATI answers 200 with {result:false, info:"…"} on some errors
  if (!res.ok || data?.result === false || data?.ok === false) throw new Error(`WATI ${res.status}: ${data?.info || text.slice(0, 200)}`);
  return data;
}

const sendText = (to: string, text: string) => call(`/api/v1/sendSessionMessage/${to}?messageText=${encodeURIComponent(text)}`);

export async function sendWati(to: string, p: WaPayload): Promise<unknown> {
  const type = p.type as string;
  if (type === 'text') return sendText(to, (p.text as { body: string }).body);
  if (type === 'image' || type === 'video') {
    const m = p[type] as { link: string; caption?: string };
    try {
      return await call(`/api/v1/sendSessionFileViaUrl/${to}?url=${encodeURIComponent(m.link)}${m.caption ? `&caption=${encodeURIComponent(m.caption)}` : ''}`);
    } catch {
      return sendText(to, `${m.caption ? m.caption + '\n' : ''}${m.link}`);
    }
  }
  if (type === 'interactive') {
    const i = p.interactive as Interactive;
    const image = i.header?.type === 'image' ? i.header.image?.link : '';
    try {
      if (i.type === 'button') {
        return await call(`/api/v1/sendInteractiveButtonsMessage?whatsappNumber=${to}`, {
          ...(image ? { header: { type: 'Image', media: { url: image, fileName: 'design.jpg' } } } : {}),
          body: i.body.text,
          ...(i.footer ? { footer: i.footer.text } : {}),
          buttons: (i.action.buttons || []).map((b) => ({ text: b.reply.title })),
        });
      }
      return await call(`/api/v1/sendInteractiveListMessage?whatsappNumber=${to}`, {
        header: i.header?.text || '',
        body: i.body.text,
        footer: i.footer?.text || '',
        buttonText: i.action.button || 'Select',
        sections: (i.action.sections || []).map((s) => ({ title: s.title, rows: s.rows.map((r) => ({ title: r.title, description: r.description || '' })) })),
      });
    } catch (err) {
      console.warn('WATI interactive failed, sending text instead:', (err as Error).message);
      if (image) {
        try {
          await call(`/api/v1/sendSessionFileViaUrl/${to}?url=${encodeURIComponent(image)}`);
        } catch {
          /* photo optional */
        }
      }
      return sendText(to, asText(i));
    }
  }
  return null;
}

