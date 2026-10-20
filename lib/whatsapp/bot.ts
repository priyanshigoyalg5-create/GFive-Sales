/**
 * GFive WhatsApp bot (customers = trade buyers).
 *
 * Menu: new designs (with photos) · order · my orders · customer care ·
 * talk to my Sales Person · address/contact.
 * Every new chat becomes a Lead, scored and given to one Sales Person
 * (same rules as the Leads page). Adapted from the SLG RWA bot.
 */
import { CATEGORIES, categoryName, normCategory } from '../categories';
import { inr } from '../format';
import { buildLeadContext, normPhone, pickAssignee, type Lead } from '../leads';
import { getOrderLines, orderSeller, orderStatus, displayOrderId } from '../orders';
import { samplePhotos } from '../sample-photos';
import type { Sample } from '../types';
import { P, type WaPayload } from './payloads';
import type { BotStore, WaSession } from './store';

export const STATE_TTL_MS = 60 * 60 * 1000; // an unfinished step (e.g. complaint) expires after 1 hour
const LEAD_REUSE_DAYS = 30; // same number within 30 days → same lead
const PAGE = 3; // designs per batch

export interface Incoming {
  id: string;
  from: string; // 91XXXXXXXXXX
  type: string;
  text?: { body?: string };
  interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
  button?: { payload?: string; text?: string };
  image?: { id: string; caption?: string };
  video?: { id: string; caption?: string };
  document?: { id: string; caption?: string; filename?: string };
  audio?: { id: string };
}

export interface BotDeps {
  store: BotStore;
  send: (to: string, p: WaPayload) => Promise<unknown>;
  siteUrl: string; // https://gfivesales.vercel.app
  now?: () => number;
}

type Parsed = { kind: 'text'; text: string } | { kind: 'action'; id: string; title?: string } | { kind: 'media'; what: string; caption: string } | { kind: 'other' };

export function parse(m: Incoming): Parsed {
  switch (m.type) {
    case 'text':
      return { kind: 'text', text: (m.text?.body || '').trim() };
    case 'interactive': {
      const r = m.interactive?.button_reply || m.interactive?.list_reply;
      return r ? { kind: 'action', id: r.id, title: r.title } : { kind: 'other' };
    }
    case 'button':
      return { kind: 'action', id: m.button?.payload || m.button?.text || '' };
    case 'image':
    case 'video':
    case 'document':
    case 'audio': {
      const c = (m as unknown as Record<string, { caption?: string }>)[m.type]?.caption || '';
      return { kind: 'media', what: m.type, caption: c.trim() };
    }
    default:
      return { kind: 'other' };
  }
}

const GREET = /^(hi+|hello|hey|hii+|namaste|namaskar|menu|start|help|\/start|hlo|helo)\b/i;

/** Big jpg for WhatsApp (max 5 MB) from a Cloudinary URL. */
function waImage(url: string) {
  return url.includes('res.cloudinary.com') && url.includes('/upload/') ? url.replace('/upload/', '/upload/w_1080,h_1350,c_limit,f_jpg,q_80/') : url;
}

export function designCaption(s: Sample) {
  return [
    `*Design #${s.designNumber}*${categoryName(s.category) ? ` · ${categoryName(s.category)}` : ''}`,
    `Rate: *${inr(s.price)}/pc*`,
    s.fabric ? `Fabric: ${s.fabric}` : '',
    s.work ? `Work: ${s.work}` : '',
    s.aiImages?.includes(samplePhotos(s)[0]) ? '_Photo: AI generated model look_' : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function link(deps: BotDeps, sampleId: string, ref?: string) {
  return `${deps.siteUrl.replace(/\/$/, '')}/s/${sampleId}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;
}

/** Finds a design number written in a message ("RZ0138 ka rate?"). */
export function findDesign(text: string, samples: Sample[]): Sample | null {
  const words = text.toLowerCase().replace(/[#,.?!:]/g, ' ').split(/\s+/).filter((w) => w.length >= 3);
  if (!words.length) return null;
  const byNo = new Map(samples.map((s) => [String(s.designNumber).toLowerCase().replace(/\s+/g, ''), s]));
  for (const w of words) {
    const hit = byNo.get(w);
    if (hit) return hit;
  }
  return null;
}

function mainMenu(name: string, company: string): WaPayload {
  return P.list(
    `Namaste${name ? ` ${name}` : ''} 🙏\n*${company}* mein swagat hai — designer unstitched suits (wholesale).\n\nKya dekhna hai? Neeche *Select* tap karein.`,
    'Select',
    [
      { id: 'm:new', title: '🆕 Naye designs', description: 'Photo, rate aur order link' },
      { id: 'm:order', title: '🛒 Order karein', description: 'Design no. bhejein ya design chunein' },
      { id: 'm:mine', title: '📦 Mere orders', description: 'Status dekhein' },
      { id: 'm:care', title: '🧵 Customer care', description: 'Complaint / sawaal (photo bhi bhej sakte hain)' },
      { id: 'm:sp', title: '📞 Sales Person se baat' },
      { id: 'm:contact', title: '🏢 Address / contact' },
    ],
    { footer: 'Kabhi bhi "menu" likhein' },
  );
}

function categoryMenu(): WaPayload {
  return P.list('Kaunsi collection dekhni hai?', 'Select', [
    ...CATEGORIES.map((c) => ({ id: `cat:${c.id}:0`, title: c.name })),
    { id: 'cat:all:0', title: 'Sab naye designs' },
  ]);
}

export async function handle(m: Incoming, contactName: string, deps: BotDeps): Promise<void> {
  const { store } = deps;
  const now = (deps.now || Date.now)();
  const phone = normPhone(m.from);
  if (!(await store.claimMessage(m.id))) return; // Meta sent it again

  const cfg = await store.getConfig();
  if (!cfg.on) return;
  const tests = cfg.testNumbers.map(normPhone).filter(Boolean);
  if (tests.length && !tests.includes(phone)) return; // test mode: only our own numbers

  const say = (p: WaPayload) => deps.send(phone, p);
  const settings = await store.getSettings();
  const company = settings.companyName || 'GFive Kolkata';
  let sess: WaSession = await store.getSession(phone);
  const p = parse(m);
  const text = p.kind === 'text' ? p.text : p.kind === 'media' ? p.caption : '';

  // STOP / START (Meta policy)
  if (p.kind === 'text' && /^(stop|unsubscribe)$/i.test(text)) {
    await store.saveSession(phone, { optOut: true, lastInboundAt: now });
    await say(P.text('Theek hai, ab aapko GFive se message nahi aayenge. Dobara shuru karne ke liye *START* likhein.'));
    return;
  }
  if (sess.optOut) {
    if (p.kind === 'text' && /^start$/i.test(text)) {
      await store.saveSession(phone, { optOut: false });
      sess = { ...sess, optOut: false };
    } else return;
  }

  // expire half-finished steps (e.g. a complaint left in the middle)
  if (sess.state && (!sess.stateAt || now - sess.stateAt > STATE_TTL_MS)) sess = { ...sess, state: '' };

  // ---------- lead: every chat belongs to one Sales Person
  const lead = await ensureLead(phone, contactName, text, sess, deps, now);
  await store.saveSession(phone, { name: contactName || sess.name || '', lastInboundAt: now, leadId: lead.id, assignedUid: lead.assignedUid, ...(sess.state === '' ? { state: '' } : {}) });
  if (text && lead.id && !lead.justCreated) await addNote(lead.id, text, deps);

  const samples = (await store.samples()).filter((s) => !s.isTrashed);
  const name = (contactName || sess.name || '').split(' ')[0];

  // ---------- step in progress
  if (sess.state === 'care' && (p.kind === 'text' || p.kind === 'media') && !GREET.test(text)) {
    const msg = p.kind === 'media' ? `${p.caption || ''} [${p.what} bheja — WhatsApp chat mein dekhein]`.trim() : text;
    const id = await store.createLead({
      name: contactName || sess.name || '',
      phone,
      source: 'whatsapp',
      kind: 'care',
      message: msg.slice(0, 500),
      status: 'new',
      assignedUid: lead.assignedUid,
      assignedName: lead.assignedName,
      assignReason: 'Customer care · their Sales Person',
      notes: [],
    } as Omit<Lead, 'id'>);
    await store.saveSession(phone, { state: '' });
    await say(P.buttons(`✅ Aapki baat note ho gayi (ref: ${id.slice(-5).toUpperCase()}).\n${lead.assignedName ? `*${lead.assignedName}*` : 'Hamari team'} jaldi aapse sampark karenge.`, [{ id: 'm:menu', title: 'Menu' }]));
    return;
  }
  if (sess.state === 'order_ask' && p.kind === 'text' && !GREET.test(text)) {
    const s = findDesign(text, samples);
    await store.saveSession(phone, { state: '' });
    if (s) return sendOrderLink(s, lead, deps, say);
    await say(P.buttons(`"${text.slice(0, 40)}" naam ka design nahi mila. Naye designs dekh kar chunein:`, [{ id: 'm:new', title: '🆕 Naye designs' }, { id: 'm:menu', title: 'Menu' }]));
    return;
  }

  // ---------- buttons / list
  if (p.kind === 'action') {
    const [a, b, c] = p.id.split(':');
    const key = a === 'm' ? `m:${b}` : a;
    switch (key) {
      case 'm:menu':
        return void (await say(mainMenu(name, company)));
      case 'm:new':
        return void (await say(categoryMenu()));
      case 'cat':
        return sendDesigns(samples, b, Number(c) || 0, deps, say);
      case 'order': {
        const s = samples.find((x) => x.id === b);
        if (s) return sendOrderLink(s, lead, deps, say);
        return void (await say(P.text('Yeh design ab available nahi hai. "menu" likhein.')));
      }
      case 'm:order':
        await store.saveSession(phone, { state: 'order_ask', stateAt: now });
        return void (await say(P.buttons('Design no. likh kar bhejein (jaise *RZ0138*), ya naye designs mein se chunein.', [{ id: 'm:new', title: '🆕 Naye designs' }])));
      case 'm:mine':
        return sendMyOrders(phone, deps, say);
      case 'm:care':
        await store.saveSession(phone, { state: 'care', stateAt: now });
        return void (await say(P.text('Apni baat ek message mein likhein — order no., design no., kya dikkat hai. Photo / video bhi bhej sakte hain.')));
      case 'm:sp':
        return sendSalesPerson(lead, deps, say);
      case 'm:contact':
        return void (await say(P.text(contactText(settings))));
      default:
        return void (await say(mainMenu(name, company)));
    }
  }

  // ---------- free text
  if (p.kind === 'text') {
    if (!text || GREET.test(text)) return void (await say(mainMenu(name, company)));
    const s = findDesign(text, samples);
    if (s) {
      await store.updateLead(lead.id, { designId: s.id, designNumber: String(s.designNumber), category: s.category || '' });
      return sendDesignCard(s, deps, say);
    }
    if (/\b(rate|price|pp|kitna|catalog|catalogue|design|new|naya|naye|collection)\b/i.test(text)) return void (await say(categoryMenu()));
    if (/\b(order|status|dispatch|bilty|lr|delivery|kab)\b/i.test(text)) return sendMyOrders(phone, deps, say);
  }
  if (lead.justCreated) return void (await say(mainMenu(name, company)));
  await say(P.buttons('Aapka message mil gaya 🙏 Aapke Sales Person ko bata diya hai.\nNeeche se bhi chun sakte hain:', [{ id: 'm:menu', title: 'Menu' }, { id: 'm:sp', title: '📞 Sales Person' }]));
}

// ---------------------------------------------------------------- helpers

type LeadRef = { id: string; assignedUid: string; assignedName: string; justCreated: boolean };

async function ensureLead(phone: string, name: string, text: string, sess: WaSession, deps: BotDeps, now: number): Promise<LeadRef> {
  const { store } = deps;
  if (sess.leadId) {
    const l = await store.getLead(sess.leadId);
    const created = l?.createdAt ? (l.createdAt as unknown as { toMillis?: () => number }).toMillis?.() || 0 : 0;
    const fresh = l && (now - created < LEAD_REUSE_DAYS * 86_400_000 || (l.status !== 'converted' && l.status !== 'lost'));
    if (l && fresh) return { id: l.id, assignedUid: l.assignedUid, assignedName: l.assignedName, justCreated: false };
  }
  const [orders, team, receivers, openCount, samples] = await Promise.all([store.ordersByPhone(phone), store.team(), store.receivers(), store.openLeadCounts(), store.samples()]);
  const design = text ? findDesign(text, samples) : null;
  const draft: Lead = {
    id: '',
    name: name || '',
    phone,
    source: 'whatsapp',
    kind: 'sales',
    message: text.slice(0, 500),
    designId: design?.id || '',
    designNumber: design ? String(design.designNumber) : '',
    category: design?.category || '',
    status: 'new',
    assignedUid: '',
    assignedName: '',
    notes: [],
  };
  const ctx = buildLeadContext(orders, []);
  const who = pickAssignee(draft, ctx, team, receivers, openCount);
  const id = await store.createLead({
    ...draft,
    city: orders[0]?.city || '',
    assignedUid: who?.uid || '',
    assignedName: who?.name || '',
    assignReason: who ? `Auto · ${who.reason}` : '',
  } as Omit<Lead, 'id'>);
  return { id, assignedUid: who?.uid || '', assignedName: who?.name || '', justCreated: true };
}

async function addNote(leadId: string, text: string, deps: BotDeps) {
  const l = await deps.store.getLead(leadId);
  if (!l) return;
  const notes = [...(l.notes || []), { at: (deps.now || Date.now)(), by: 'WhatsApp', text: text.slice(0, 300) }].slice(-30);
  await deps.store.updateLead(leadId, { notes });
}

async function sendDesignCard(s: Sample, deps: BotDeps, say: (p: WaPayload) => Promise<unknown>) {
  const photo = samplePhotos(s)[0];
  const body = designCaption(s);
  const buttons = [{ id: `order:${s.id}`, title: '🛒 Order karein' }, { id: 'm:sp', title: '📞 Sales Person' }];
  await say(photo ? P.buttons(body, buttons, { imageUrl: waImage(photo) }) : P.buttons(body, buttons));
}

async function sendDesigns(samples: Sample[], cat: string, offset: number, deps: BotDeps, say: (p: WaPayload) => Promise<unknown>) {
  const list = cat === 'all' ? samples : samples.filter((s) => normCategory(s.category) === cat);
  const page = list.slice(offset, offset + PAGE);
  if (!page.length) {
    await say(P.buttons(offset ? 'Bas itne hi designs hain abhi 🙏' : 'Is collection mein abhi koi design nahi hai.', [{ id: 'm:new', title: 'Doosri collection' }, { id: 'm:menu', title: 'Menu' }]));
    return;
  }
  for (const s of page) await sendDesignCard(s, deps, say);
  const more = offset + PAGE < list.length;
  await say(
    P.buttons(
      `${offset + 1}–${offset + page.length} of ${list.length} designs${cat !== 'all' ? ` · ${categoryName(cat)}` : ''}.\nOrder karne ke liye design ke neeche *Order karein* tap karein.`,
      [...(more ? [{ id: `cat:${cat}:${offset + PAGE}`, title: 'Aur designs ➡️' }] : []), { id: 'm:new', title: 'Doosri collection' }, { id: 'm:menu', title: 'Menu' }],
    ),
  );
}

async function sendOrderLink(s: Sample, lead: LeadRef, deps: BotDeps, say: (p: WaPayload) => Promise<unknown>) {
  await deps.store.updateLead(lead.id, { designId: s.id, designNumber: String(s.designNumber), category: s.category || '', status: 'interested' });
  await say(
    P.text(
      `🛒 *Design #${s.designNumber}* ka order:\nIs link par colour-wise pieces chunein, apni firm details bharein aur *Place order* tap karein 👇\n${link(deps, s.id, lead.assignedUid)}`,
      true,
    ),
  );
}

async function sendMyOrders(phone: string, deps: BotDeps, say: (p: WaPayload) => Promise<unknown>) {
  const orders = (await deps.store.ordersByPhone(phone)).filter((o) => !o.isTrashed).slice(0, 5);
  if (!orders.length) {
    await say(P.buttons('Is number se koi order nahi mila. Naya order dene ke liye design chunein:', [{ id: 'm:new', title: '🆕 Naye designs' }, { id: 'm:sp', title: '📞 Sales Person' }]));
    return;
  }
  const lines = orders.map((o) => {
    const designs = getOrderLines(o).map((l) => `#${l.designNumber}`).join(', ');
    return `*${displayOrderId(o)}* · ${designs}\n${o.totalQuantity} pcs · ${inr(o.totalAmount)} · *${orderStatus(o)}*${orderSeller(o).name !== 'Unassigned' ? ` · ${orderSeller(o).name}` : ''}`;
  });
  await say(P.buttons(`📦 Aapke pichhle ${orders.length} order:\n\n${lines.join('\n\n')}`, [{ id: 'm:sp', title: '📞 Sales Person' }, { id: 'm:menu', title: 'Menu' }]));
}

async function sendSalesPerson(lead: LeadRef, deps: BotDeps, say: (p: WaPayload) => Promise<unknown>) {
  const team = await deps.store.team();
  const sp = team.find((t) => t.uid === lead.assignedUid && t.active !== false);
  if (sp?.whatsappNumber) {
    await say(P.text(`📞 Aapke Sales Person: *${sp.name}*\nWhatsApp / call: +${sp.whatsappNumber}\nhttps://wa.me/${sp.whatsappNumber}`, true));
  } else {
    const st = await deps.store.getSettings();
    await say(P.text(`📞 Hamari team aapse jaldi sampark karegi.\nOffice: +${st.whatsappNumber || ''}`));
  }
}

function contactText(st: { companyName?: string; addressLine?: string; storePhone?: string; whatsappNumber?: string; email?: string; website?: string; instagram?: string }) {
  return [
    `🏢 *${st.companyName || 'GFive Kolkata'}*`,
    st.addressLine,
    st.storePhone ? `📞 ${st.storePhone}` : '',
    st.whatsappNumber ? `💬 +${st.whatsappNumber}` : '',
    st.email ? `✉️ ${st.email}` : '',
    st.website ? `🌐 ${st.website}` : '',
    st.instagram ? `📸 Instagram: ${st.instagram}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
