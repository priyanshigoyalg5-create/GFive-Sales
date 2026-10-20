import type { Order, PublicStaff } from './types';
import { digitsOnly, tsToDate } from './format';
import type { Timestamp } from 'firebase/firestore';

/**
 * Leads = people who showed interest but have not ordered yet (WhatsApp, Instagram,
 * Facebook, website call-back, or added by hand). Every lead is scored ("lead filter")
 * and handed to ONE Sales Person.
 */

export type LeadSource = 'website' | 'whatsapp' | 'instagram' | 'facebook' | 'comment' | 'manual';
export type LeadStatus = 'new' | 'contacted' | 'interested' | 'converted' | 'lost';
export type LeadTemp = 'hot' | 'warm' | 'cold';

export interface LeadNote {
  at: number; // ms
  by: string; // name
  text: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string; // digits with country code when known
  city?: string;
  handle?: string; // @instagram / facebook name
  source: LeadSource;
  message?: string;
  designId?: string;
  designNumber?: string;
  category?: string;
  qty?: number; // pieces they mentioned
  status: LeadStatus;
  assignedUid: string; // '' = not yet given to anyone
  assignedName: string;
  assignReason?: string;
  assignedAt?: Timestamp | null;
  refUid?: string; // Sales Person whose link brought them
  followUpAt?: number | null; // ms
  notes?: LeadNote[];
  createdByUid?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export const LEAD_SOURCES: Record<LeadSource, { label: string; color: string }> = {
  website: { label: 'Website', color: 'bg-leaf-50 text-leaf-800' },
  whatsapp: { label: 'WhatsApp', color: 'bg-[#e7f8ee] text-[#0f7a3d]' },
  instagram: { label: 'Instagram', color: 'bg-[#fdebf3] text-[#a3205c]' },
  facebook: { label: 'Facebook', color: 'bg-[#e8f0fe] text-[#1d4fb8]' },
  comment: { label: 'Post comment', color: 'bg-gold-50 text-gold-600' },
  manual: { label: 'Added by team', color: 'bg-sand text-ink' },
};

export const LEAD_STATUSES: { id: LeadStatus; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'interested', label: 'Interested' },
  { id: 'converted', label: 'Converted' },
  { id: 'lost', label: 'Lost' },
];

export const TEMP_STYLE: Record<LeadTemp, { label: string; pill: string; dot: string }> = {
  hot: { label: 'Hot', pill: 'bg-red-50 text-red-800 ring-red-200', dot: 'bg-red-600' },
  warm: { label: 'Warm', pill: 'bg-amber-50 text-amber-900 ring-amber-200', dot: 'bg-amber-500' },
  cold: { label: 'Cold', pill: 'bg-sky-50 text-sky-900 ring-sky-200', dot: 'bg-sky-500' },
};

/** 10-digit Indian mobile → 91XXXXXXXXXX; anything else: digits as given. */
export function normPhone(v: string | undefined | null): string {
  let d = digitsOnly(v || '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = `91${d}`;
  return d;
}

const BUY_WORDS = /\b(order|rate|price|pp|kitna|kitne|daam|pcs|pieces?|piece|set|qty|quantity|chahiye|bhejo|book|available|stock|wholesale|catalog(ue)?)\b/i;
const SPAM_WORDS = /\b(loan|crypto|bitcoin|earn money|work from home|followers|seo|marketing services|lottery|investment)\b|https?:\/\//i;

export interface LeadContext {
  /** past orders by phone (normalised) → count, last seller */
  customers: Map<string, { orders: number; lastSellerUid: string; lastSellerName: string; firm: string }>;
  /** how many leads share this phone */
  phoneCount: Map<string, number>;
}

export interface LeadScore {
  score: number; // 0–100
  temp: LeadTemp;
  spam: boolean;
  duplicate: boolean;
  repeatCustomer: boolean;
  reasons: string[];
}

/** The "lead filter": how likely this enquiry is to become an order. */
export function scoreLead(l: Lead, ctx?: LeadContext): LeadScore {
  const reasons: string[] = [];
  const text = `${l.message || ''} ${l.name || ''}`;
  const phone = normPhone(l.phone);
  const validPhone = phone.length >= 12 && phone.length <= 13;
  let s = 10;

  const spam = SPAM_WORDS.test(text) || (!validPhone && !l.handle && !(l.message || '').trim());
  if (spam) return { score: 0, temp: 'cold', spam: true, duplicate: false, repeatCustomer: false, reasons: ['Looks like spam'] };

  const cust = ctx?.customers.get(phone);
  if (cust) {
    s += 35;
    reasons.push(`Existing customer · ${cust.orders} order${cust.orders > 1 ? 's' : ''}`);
  }
  if (l.designId || l.designNumber) {
    s += 20;
    reasons.push('Asked about a design');
  }
  if ((l.qty || 0) > 0 || BUY_WORDS.test(text)) {
    s += 20;
    reasons.push('Talks about rate / order / pieces');
  }
  if ((l.qty || 0) >= 10) {
    s += 10;
    reasons.push(`${l.qty} pcs`);
  }
  if (validPhone) {
    s += 10;
    reasons.push('Mobile number given');
  }
  if (l.city) s += 5;
  if (l.source === 'website' || l.source === 'whatsapp') s += 5; // they reached out directly
  if (l.status === 'interested') {
    s += 15;
    reasons.push('Marked interested');
  }
  const duplicate = (ctx?.phoneCount.get(phone) || 0) > 1 && validPhone;
  if (duplicate) {
    s += 5;
    reasons.push('Asked more than once');
  }
  const created = tsToDate(l.createdAt);
  const ageDays = created ? (Date.now() - created.getTime()) / 86_400_000 : 0;
  if (ageDays > 30 && l.status !== 'interested') {
    s -= 15;
    reasons.push('Older than 30 days');
  }
  const score = Math.max(0, Math.min(100, s));
  const temp: LeadTemp = score >= 60 ? 'hot' : score >= 35 ? 'warm' : 'cold';
  return { score, temp, spam: false, duplicate, repeatCustomer: !!cust, reasons };
}

export function buildLeadContext(orders: Order[], leads: Lead[]): LeadContext {
  const customers: LeadContext['customers'] = new Map();
  // orders are newest first → first seen = last seller
  for (const o of orders) {
    if (o.isTrashed) continue;
    const p = normPhone(o.mobile);
    if (!p) continue;
    const c = customers.get(p);
    if (c) c.orders += 1;
    else customers.set(p, { orders: 1, lastSellerUid: o.salesPersonUid || '', lastSellerName: o.salesPersonName || o.salesPerson || '', firm: o.firmName || '' });
  }
  const phoneCount = new Map<string, number>();
  for (const l of leads) {
    const p = normPhone(l.phone);
    if (p) phoneCount.set(p, (phoneCount.get(p) || 0) + 1);
  }
  return { customers, phoneCount };
}

/**
 * Who should get this lead?
 *  1. The Sales Person whose link the customer came from.
 *  2. An existing customer → the Sales Person of their last order.
 *  3. Otherwise the receiver with the fewest open leads (fair rotation).
 */
export function pickAssignee(
  l: Lead,
  ctx: LeadContext,
  team: PublicStaff[],
  receivers: string[], // uids allowed to receive new leads ([] = everyone active)
  openCount: Map<string, number>,
): { uid: string; name: string; reason: string } | null {
  const active = team.filter((t) => t.active !== false);
  const byUid = new Map(active.map((t) => [t.uid, t]));
  if (l.refUid && byUid.has(l.refUid)) return { uid: l.refUid, name: byUid.get(l.refUid)!.name, reason: 'Came from their design link' };
  const cust = ctx.customers.get(normPhone(l.phone));
  if (cust?.lastSellerUid && byUid.has(cust.lastSellerUid)) {
    return { uid: cust.lastSellerUid, name: byUid.get(cust.lastSellerUid)!.name, reason: `Existing customer of ${byUid.get(cust.lastSellerUid)!.name}` };
  }
  const pool = (receivers.length ? active.filter((t) => receivers.includes(t.uid)) : active).sort(
    (a, b) => (openCount.get(a.uid) || 0) - (openCount.get(b.uid) || 0) || a.name.localeCompare(b.name),
  );
  const p = pool[0];
  return p ? { uid: p.uid, name: p.name, reason: 'Fair rotation (fewest open leads)' } : null;
}

export function isOpen(l: Lead) {
  return l.status !== 'converted' && l.status !== 'lost';
}
