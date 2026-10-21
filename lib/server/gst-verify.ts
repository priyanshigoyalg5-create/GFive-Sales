/**
 * Online GST check through Cashfree Secure ID ("Verify GSTIN").
 * Env (Vercel, never NEXT_PUBLIC_): CASHFREE_CLIENT_ID, CASHFREE_CLIENT_SECRET,
 * optional CASHFREE_ENV=sandbox (default production).
 * Docs: https://www.cashfree.com/docs/api-reference/vrs/v2/gstin/verify-gstin
 *
 * No "server-only" import so tests can run it with a fake fetch.
 */
import { checkGstin, namesMatch, type GstCheck } from '../gst';

type Fetch = typeof fetch;
let fetchImpl: Fetch = (...a) => fetch(...a);
export function _setGstFetch(f: Fetch) {
  fetchImpl = f;
}

export const gstOnlineReady = () => !!(process.env.CASHFREE_CLIENT_ID && process.env.CASHFREE_CLIENT_SECRET);

interface CfResponse {
  GSTIN?: string;
  legal_name_of_business?: string;
  trade_name_of_business?: string;
  gst_in_status?: string;
  constitution_of_business?: string;
  principal_place_split_address?: { city?: string; district?: string };
  valid?: boolean;
  message?: string;
  code?: string;
  type?: string;
}

/** Asks the GST records about one GSTIN and compares the names the customer gave. */
export async function verifyGstOnline(gstin: string, names: string[], now = Date.now()): Promise<GstCheck> {
  const info = checkGstin(gstin);
  if (!info.ok) throw new Error(info.reason || 'Wrong GST number');
  if (!gstOnlineReady()) throw new Error('Online GST check is not set up (CASHFREE_CLIENT_ID / CASHFREE_CLIENT_SECRET).');
  const host = process.env.CASHFREE_ENV === 'sandbox' ? 'https://sandbox.cashfree.com' : 'https://api.cashfree.com';
  const res = await fetchImpl(`${host}/verification/gstin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': process.env.CASHFREE_CLIENT_ID!,
      'x-client-secret': process.env.CASHFREE_CLIENT_SECRET!,
    },
    body: JSON.stringify({ GSTIN: info.gstin, business_name: (names.find(Boolean) || '').slice(0, 200) }),
  });
  const d = ((await res.json().catch(() => ({}))) || {}) as CfResponse;
  if (!res.ok) throw new Error(d.message || `GST check failed (${res.status})`);
  const found = d.valid === true || !!d.legal_name_of_business;
  const status = d.gst_in_status || (found ? '' : 'Not found');
  const legalName = d.legal_name_of_business || '';
  const tradeName = d.trade_name_of_business || '';
  return {
    found,
    active: found && /^active/i.test(status),
    status,
    legalName,
    tradeName,
    type: d.constitution_of_business || '',
    city: d.principal_place_split_address?.city || d.principal_place_split_address?.district || '',
    nameMatch: found && namesMatch(names, [legalName, tradeName]),
    at: now,
    message: d.message || '',
  };
}
