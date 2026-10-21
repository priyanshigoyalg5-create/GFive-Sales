/**
 * GSTIN (GST number) helpers — pure, no network.
 *
 *  22 AAAAA0000A 1 Z 5
 *  │  │          │ │ └ check character (mod-36)
 *  │  │          │ └── 'Z' by default
 *  │  │          └──── registration number for this PAN in the state (1–9, A–Z)
 *  │  └─────────────── PAN of the business (10 chars)
 *  └────────────────── state code
 *
 * The check character catches almost every typo and made-up number. Whether the GSTIN
 * is really registered / active and whose name it carries needs the online check
 * (lib/server/gst-verify.ts).
 */

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z][A-Z0-9][0-9A-Z]$/;

export const GST_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand',
  '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya',
  '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra',
  '28': 'Andhra Pradesh (old)', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
  '34': 'Puducherry', '35': 'Andaman & Nicobar', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
  '97': 'Other territory', '99': 'Centre jurisdiction',
};

/** 4th letter of the PAN = type of holder. */
const HOLDER: Record<string, string> = {
  P: 'Proprietor (individual)', C: 'Company', F: 'Partnership firm / LLP', H: 'HUF', A: 'Association of persons',
  T: 'Trust', B: 'Body of individuals', L: 'Local authority', J: 'Artificial juridical person', G: 'Government',
};

/** Upper-case, drop spaces / dashes / dots. */
export function normGstin(v: string | undefined | null): string {
  return String(v || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function gstCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const p = CHARS.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
}

export interface GstinInfo {
  ok: boolean;
  gstin: string;
  reason?: string; // why it is not valid
  state?: string;
  pan?: string;
  holder?: string;
}

/** Offline check: shape, state code, check character. */
export function checkGstin(v: string | undefined | null): GstinInfo {
  const g = normGstin(v);
  if (!g) return { ok: false, gstin: '', reason: 'Empty' };
  if (g.length !== 15) return { ok: false, gstin: g, reason: `GST number has 15 characters (this has ${g.length})` };
  if (!SHAPE.test(g)) return { ok: false, gstin: g, reason: 'Not a GST number format (e.g. 19ABCDE1234F1Z5)' };
  const state = GST_STATES[g.slice(0, 2)];
  if (!state) return { ok: false, gstin: g, reason: `Unknown state code ${g.slice(0, 2)}` };
  if (gstCheckChar(g.slice(0, 14)) !== g[14]) return { ok: false, gstin: g, reason: 'Wrong GST number (check digit does not match) — typing mistake?' };
  const pan = g.slice(2, 12);
  return { ok: true, gstin: g, state, pan, holder: HOLDER[pan[3]] || '' };
}

/** Finds something that looks like a GST number inside a chat message. */
export function findGstin(text: string): string {
  const m = /\b([0-9]{2}\s?[A-Z]{5}\s?[0-9]{4}\s?[A-Z]\s?[0-9A-Z]{3})\b/i.exec(text || '');
  return m ? normGstin(m[1]) : '';
}

/** Mask the middle for lists: 19ABCDE1234F1Z5 → 19ABC••••••F1Z5 */
export function maskGstin(g: string) {
  return g.length === 15 ? `${g.slice(0, 5)}••••••${g.slice(11)}` : g;
}

// ---------------------------------------------------------------- name matching
const NOISE = new Set([
  'M', 'S', 'MS', 'MESSRS', 'THE', 'AND', 'OF', 'PVT', 'PRIVATE', 'LTD', 'LIMITED', 'LLP', 'CO', 'COMPANY', 'MR', 'MRS', 'SHRI', 'SMT', 'SRI', 'KUMAR', 'KUMARI',
]);
function tokens(s: string): string[] {
  return String(s || '')
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !NOISE.has(t));
}

/**
 * Does the name the customer gave match the name on the GST record (legal or trade
 * name)? Loose on purpose: "Shree Fashion" matches "SHREE FASHIONS PVT LTD", and a
 * proprietor's own name matches the legal name.
 */
export function namesMatch(given: string[], official: string[]): boolean {
  const off = official.map(tokens).filter((t) => t.length);
  for (const g of given.map(tokens).filter((t) => t.length)) {
    for (const o of off) {
      const same = g.filter((t) => o.some((x) => x === t || (t.length >= 4 && x.length >= 4 && (x.startsWith(t) || t.startsWith(x))))).length;
      if (same >= Math.min(2, g.length, o.length) && same / Math.min(g.length, o.length) >= 0.5) return true;
    }
  }
  return false;
}

/** Saved on the lead after the online check. */
export interface GstCheck {
  found: boolean; // GSTIN exists in the GST records
  active: boolean;
  status: string; // "Active", "Cancelled", "Suspended"…
  legalName: string;
  tradeName: string;
  type: string; // constitution of business
  city: string;
  nameMatch: boolean;
  at: number; // ms
  message?: string;
}

export type GstLevel = 'none' | 'invalid' | 'valid' | 'verified' | 'mismatch' | 'inactive' | 'notfound';

/** One word for badges / filter. */
export function gstLevel(gstin: string | undefined, check: GstCheck | null | undefined): GstLevel {
  if (!gstin) return 'none';
  if (!checkGstin(gstin).ok) return 'invalid';
  if (!check) return 'valid';
  if (!check.found) return 'notfound';
  if (!check.active) return 'inactive';
  return check.nameMatch ? 'verified' : 'mismatch';
}

export const GST_LEVEL_STYLE: Record<GstLevel, { label: string; pill: string }> = {
  none: { label: '', pill: '' },
  invalid: { label: 'GST wrong', pill: 'bg-red-50 text-red-800 ring-red-200' },
  valid: { label: 'GST ✓ format', pill: 'bg-leaf-50 text-leaf-800 ring-leaf-100' },
  verified: { label: 'GST verified · name matches', pill: 'bg-leaf-600 text-white ring-leaf-700' },
  mismatch: { label: 'GST active · name different', pill: 'bg-amber-50 text-amber-900 ring-amber-200' },
  inactive: { label: 'GST cancelled / inactive', pill: 'bg-red-50 text-red-800 ring-red-200' },
  notfound: { label: 'GST not found', pill: 'bg-red-50 text-red-800 ring-red-200' },
};
