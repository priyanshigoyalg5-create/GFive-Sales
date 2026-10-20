import 'server-only';

/**
 * WhatsApp Cloud API (Meta Graph API) client — ported from the SLG RWA bot.
 * Env: WA_TOKEN (system-user permanent token), WA_PHONE_NUMBER_ID,
 * optional WA_GRAPH_VERSION (default v23.0).
 */
export class WaError extends Error {
  constructor(message: string, public status?: number, public code?: number) {
    super(message);
  }
}

const graph = (path: string) => `https://graph.facebook.com/${process.env.WA_GRAPH_VERSION || 'v23.0'}/${path}`;

type Fetch = typeof fetch;
let fetchImpl: Fetch = (...a) => fetch(...a);
/** tests only */
export function _setFetch(f: Fetch) {
  fetchImpl = f;
}

async function call(path: string, json: unknown) {
  const token = process.env.WA_TOKEN;
  if (!token) throw new WaError('WA_TOKEN is not set');
  const res = await fetchImpl(graph(path), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(json),
  });
  const text = await res.text();
  let data: { error?: { message?: string; code?: number }; messages?: { id: string }[] } | null = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) throw new WaError(data?.error?.message || `Graph API ${res.status}`, res.status, data?.error?.code);
  return data;
}

import type { WaPayload } from './payloads';
export type { WaPayload };

/** to = 91XXXXXXXXXX */
export async function send(to: string, payload: WaPayload): Promise<string | null> {
  const pnid = process.env.WA_PHONE_NUMBER_ID;
  if (!pnid) throw new WaError('WA_PHONE_NUMBER_ID is not set');
  const data = await call(`${pnid}/messages`, { messaging_product: 'whatsapp', recipient_type: 'individual', to, ...payload });
  return data?.messages?.[0]?.id || null;
}

export { P, clip, type Btn, type Row } from './payloads';
