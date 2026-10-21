/**
 * Instagram & Facebook: DMs and post comments → Leads + automatic replies.
 *
 *  • DM ("Price?", "RZ0138", "hi") → lead for one Sales Person + reply with design / links.
 *  • Comment with a keyword ("price", "rate", "pp", "details"…) → ONE private DM with the
 *    design details & order link, a short public reply "DM kiya hai 🙏", and a lead.
 */
import { categoryName } from '../categories';
import { inr } from '../format';
import { checkGstin, findGstin } from '../gst';
import { assignWithFilter, buildLeadContext, isOpen, qualifies, scoreLead, type Lead } from '../leads';
import { samplePhotos } from '../sample-photos';
import type { Sample } from '../types';
import { findDesign } from '../whatsapp/bot';
import type { SocialStore } from '../whatsapp/store';
import type { Platform, QuickReply } from './graph';

export interface SocialApi {
  sendDM(p: Platform, to: string, text: string, quick?: QuickReply[]): Promise<unknown>;
  sendDMImage(p: Platform, to: string, url: string): Promise<unknown>;
  privateReply(commentId: string, text: string): Promise<unknown>;
  publicReply(p: Platform, commentId: string, text: string): Promise<unknown>;
  profileName(p: Platform, userId: string): Promise<{ name: string; handle: string }>;
}

export interface SocialDeps {
  store: SocialStore;
  api: SocialApi;
  siteUrl: string;
  ownIds: string[]; // our page / IG account ids (ignore our own messages)
  now?: () => number;
}

interface MessagingEvent {
  sender?: { id: string };
  recipient?: { id: string };
  message?: { mid?: string; text?: string; is_echo?: boolean; quick_reply?: { payload?: string }; attachments?: unknown[] };
  postback?: { mid?: string; payload?: string; title?: string };
}
interface Change {
  field?: string;
  value?: {
    // Instagram "comments"
    id?: string;
    text?: string;
    from?: { id?: string; username?: string; name?: string };
    media?: { id?: string };
    // Facebook "feed"
    item?: string;
    verb?: string;
    comment_id?: string;
    message?: string;
    post_id?: string;
    parent_id?: string;
  };
}
export interface MetaWebhookBody {
  object?: string;
  entry?: { id?: string; messaging?: MessagingEvent[]; changes?: Change[] }[];
}

const PHONE = /(?:\+?91[\s-]?)?([6-9]\d{4}[\s-]?\d{5})\b/;
const base = (d: SocialDeps) => d.siteUrl.replace(/\/$/, '');

function caption(s: Sample, showRate = true) {
  return [`Design #${s.designNumber}${categoryName(s.category) ? ` · ${categoryName(s.category)}` : ''}`, showRate ? `Rate: ${inr(s.price)}/pc` : '', s.fabric ? `Fabric: ${s.fabric}` : '', s.work ? `Work: ${s.work}` : '']
    .filter(Boolean)
    .join('\n');
}

const designUrl = (d: SocialDeps, s: Sample, platform: Platform, ref: string) =>
  `${base(d)}/s/${s.id}?${new URLSearchParams({ ...(ref ? { ref } : {}), from: platform })}`;
const bioUrl = (d: SocialDeps, platform: Platform, ref: string) => `${base(d)}/enquiry?${new URLSearchParams({ from: platform, ...(ref ? { ref } : {}) })}`;

/** Find or create the lead for this Instagram / Facebook person. */
async function ensureLead(
  d: SocialDeps,
  platform: Platform,
  userId: string,
  first: { text: string; source: 'instagram' | 'facebook' | 'comment'; design: Sample | null; name?: string; handle?: string },
) {
  const key = `${platform}_${userId}`;
  const sess = await d.store.getSocialSession(key);
  if (sess.leadId) {
    const l = await d.store.getLead(sess.leadId);
    if (l && l.status !== 'converted' && l.status !== 'lost') return { lead: l, key, sess, created: false };
  }
  const who0 = first.name || first.handle ? { name: first.name || '', handle: first.handle || '' } : await d.api.profileName(platform, userId);
  const draft: Lead = {
    id: '',
    name: who0.name || who0.handle || '',
    handle: who0.handle || '',
    phone: '',
    source: first.source,
    kind: 'sales',
    message: first.text.slice(0, 500),
    designId: first.design?.id || '',
    designNumber: first.design ? String(first.design.designNumber) : '',
    category: first.design?.category || '',
    status: 'new',
    assignedUid: '', // the lead filter decides (screen) — not every Instagram chat goes to a Sales Person
    assignedName: '',
    holdReason: 'New — checking',
    notes: [],
  };
  const lead = draft;
  const id = await d.store.createLead({ ...lead, socialId: `${platform}:${userId}` } as unknown as Omit<Lead, 'id'>);
  await d.store.saveSocialSession(key, { leadId: id, name: lead.name, updatedAt: (d.now || Date.now)() });
  return { lead: { ...lead, id }, key, sess, created: true };
}

/**
 * Lead filter for Instagram / Facebook: give the lead to a Sales Person only when it
 * passes (mobile number, shop / wholesale buyer, score, pieces — Lead filter settings).
 */
export async function screen(d: SocialDeps, lead: Lead): Promise<Lead> {
  if (lead.assignedUid || !isOpen(lead)) return lead;
  const [orders, f, team, openCount] = await Promise.all([lead.phone ? d.store.ordersByPhone(lead.phone) : Promise.resolve([]), d.store.getLeadFilter(), d.store.team(), d.store.openLeadCounts()]);
  const ctx = buildLeadContext(orders, []);
  const sc = scoreLead(lead, ctx);
  const q = qualifies(lead, sc, f);
  const who = q.ok ? assignWithFilter(lead, ctx, team, f, openCount) : null;
  if (who) {
    const patch = { assignedUid: who.uid, assignedName: who.name, assignReason: `Auto · ${who.reason}`, holdReason: '' };
    await d.store.updateLead(lead.id, patch);
    return { ...lead, ...patch };
  }
  const holdReason = q.ok ? 'Every Sales Person is at the lead limit' : q.reason;
  if (holdReason !== lead.holdReason) await d.store.updateLead(lead.id, { holdReason });
  return { ...lead, holdReason };
}

const BIZ = /\b(shop|boutique|wholesale|wholesaler|retailer|dukaan|dukan|business|trader|showroom|reseller|store)\b/i;
const PERSONAL = /\b(personal|apne liye|khud|self|myself|ghar ke liye|own use|for me)\b/i;
const PCS = /(\d{1,4})\s*(pcs|pc|pieces?|sets?|nos)\b/i;

/** Pull buyer type / pieces from a reply (quick-reply payload or free text). */
export function readAnswers(text: string, payload: string): Partial<Lead> {
  const out: Partial<Lead> = {};
  if (payload === 'BIZ' || BIZ.test(text)) out.buyerType = 'business';
  else if (payload === 'PERSONAL' || PERSONAL.test(text)) out.buyerType = 'personal';
  const qp = { Q_SMALL: 5, Q_MID: 20, Q_BIG: 50 }[payload as 'Q_SMALL' | 'Q_MID' | 'Q_BIG'];
  const qt = PCS.exec(text)?.[1];
  if (qp) out.qty = qp;
  else if (qt) out.qty = Number(qt);
  return out;
}

const askType = (): QuickReply[] => [
  { title: '🏬 Shop / boutique', payload: 'BIZ' },
  { title: '🙋 Apne liye', payload: 'PERSONAL' },
];
const askPcs = (): QuickReply[] => [
  { title: '1–9 pcs', payload: 'Q_SMALL' },
  { title: '10–49 pcs', payload: 'Q_MID' },
  { title: '50+ pcs', payload: 'Q_BIG' },
];

const menu = (): QuickReply[] => [
  { title: '🆕 Naye designs', payload: 'NEW' },
  { title: '💰 Rate / order', payload: 'RATE' },
  { title: '📞 Call back', payload: 'CALL' },
  { title: '💬 WhatsApp', payload: 'WA' },
];

async function handleDM(d: SocialDeps, platform: Platform, e: MessagingEvent) {
  const userId = e.sender?.id || '';
  if (!userId || d.ownIds.includes(userId) || e.message?.is_echo) return;
  const mid = e.message?.mid || e.postback?.mid || '';
  if (mid && !(await d.store.claimMessage(`${platform}_${mid}`))) return;
  const cfg = await d.store.getSocialConfig();
  const text = (e.message?.text || e.postback?.title || '').trim();
  const payload = e.message?.quick_reply?.payload || e.postback?.payload || '';
  const samples = (await d.store.samples()).filter((s) => !s.isTrashed);
  const gstRaw = findGstin(text);
  const gst = gstRaw ? checkGstin(gstRaw) : null;
  const design = text && !gstRaw ? findDesign(text, samples) : null;
  const f = await d.store.getLeadFilter();

  const got = await ensureLead(d, platform, userId, { text, source: platform, design });
  const { key, sess, created } = got;
  const notes = [...(got.lead.notes || []), { at: (d.now || Date.now)(), by: platform === 'instagram' ? 'Instagram DM' : 'Messenger', text: text || '[photo / sticker]' }].slice(-30);
  const phone = PHONE.exec(text)?.[1]?.replace(/\D/g, '');
  const answers = readAnswers(text, payload);
  const patch: Partial<Lead> = {
    notes,
    ...answers,
    ...(design ? { designId: design.id, designNumber: String(design.designNumber), category: design.category || '' } : {}),
    ...(phone ? { phone: `91${phone}` } : {}),
  };
  if (gst?.ok) {
    patch.gstin = gst.gstin;
    patch.buyerType = 'business'; // has a GST number → trade buyer
    if (f.gstOnline && d.store.checkGst) {
      const names = [got.lead.firm || '', got.lead.name || ''];
      patch.gstCheck = await d.store.checkGst(gst.gstin, names).catch((err) => (console.error('gst check', err), null));
    }
  }
  if (gst || payload === 'NO_GST') await d.store.saveSocialSession(key, { state: '', gstAsked: true });
  await d.store.updateLead(got.lead.id, patch);
  const before = got.lead.assignedUid;
  const lead = await screen(d, { ...got.lead, ...patch }); // lead filter
  if (!cfg.on) return; // leads still recorded; no automatic answer

  const ref = lead.assignedUid;
  const say = (t: string, q: QuickReply[] = menu()) => d.api.sendDM(platform, userId, t, q);

  // ---------- answers to the bot's own questions (buyer type → pieces → mobile)
  if (answers.buyerType === 'personal' && f.personal === 'hold') {
    const st = await d.store.getSettings();
    return void (await say(`Shukriya 🙏 Hum wholesale (shop / boutique) ke liye kaam karte hain.${st.website ? `\nApne liye kharidne ke liye hamara online store dekhein 👇\n${st.website}` : ''}`, []));
  }
  if (gst && !gst.ok) {
    await d.store.saveSocialSession(key, { state: 'gst_ask' });
    return void (await say(`Yeh GST number sahi nahi lag raha 🤔 (${gst.reason})\nKripya 15-character GST number dobara bhejein, jaise 19ABCDE1234F1Z5.`, [{ title: 'GST nahi hai', payload: 'NO_GST' }]));
  }
  if (lead.assignedUid && !before) {
    return void (await say(`Shukriya 🙏 ${lead.assignedName} aapko${lead.phone ? ` +${lead.phone}` : ''} par jaldi call karenge. Tab tak naye designs dekhein 👇\n${bioUrl(d, platform, ref)}`, []));
  }
  if (design) {
    const ph = samplePhotos(design)[0];
    if (ph) await d.api.sendDMImage(platform, userId, ph.replace('/upload/', '/upload/w_1080,h_1350,c_limit,f_jpg,q_80/')).catch(() => {});
    await say(`${caption(design, true)}\n\nSaare colours dekhein aur order karein 👇\n${designUrl(d, design, platform, ref)}`, []);
    return void (await nextQuestion(d, platform, userId, key, lead));
  }
  switch (payload) {
    case 'NEW':
      await say(`✨ Naye designs (photo, rate, order) yahan dekhein 👇\n${bioUrl(d, platform, ref)}`, []);
      return void (await nextQuestion(d, platform, userId, key, lead));
    case 'RATE':
      return void (await say('Design no. bhejein (jaise RZ0138), ya post ka screenshot bhejein — hum rate aur colours bata denge.', []));
    case 'CALL':
      await d.store.saveSocialSession(key, { state: 'phone_ask' });
      return void (await say('Apna mobile number bhejein, hamare Sales Person call karenge 📞', []));
    case 'WA': {
      const team = await d.store.team();
      const sp = team.find((t) => t.uid === lead.assignedUid);
      const st = await d.store.getSettings();
      return void (await say(`WhatsApp par baat karein 👇\nhttps://wa.me/${sp?.whatsappNumber || st.whatsappNumber}`, []));
    }
  }
  if (sess.state === 'phone_ask' && text && !phone) {
    return void (await say('Mobile number 10 digit mein bhejein (jaise 98xxxxxxxx), taaki hum call kar sakein.', []));
  }
  if (gst?.ok && !lead.assignedUid) {
    await say('Shukriya 🙏 GST number mil gaya. Hamari team check karke aapse contact karegi.', []);
    return void (await nextQuestion(d, platform, userId, key, lead));
  }
  if (sess.state === 'gst_ask' && payload !== 'NO_GST' && text && !gst) {
    return void (await say('GST number 15 characters ka hota hai (jaise 19ABCDE1234F1Z5). Nahi hai toh "GST nahi hai" dabayein.', [{ title: 'GST nahi hai', payload: 'NO_GST' }]));
  }
  if (payload === 'NO_GST') {
    if (!lead.assignedUid) await say('Koi baat nahi 🙏 Hamari team aapse jaldi contact karegi.', []);
    return;
  }
  if (answers.buyerType || answers.qty || phone) return void (await nextQuestion(d, platform, userId, key, lead));
  if (created || /^(hi+|hello|hey|namaste|menu|start)\b/i.test(text)) {
    await say(`Namaste 🙏 GFive Kolkata — designer unstitched suits (wholesale).\nKya dekhna hai?`);
    return;
  }
  if (!lead.assignedUid) return void (await nextQuestion(d, platform, userId, key, lead));
  await say('Aapka message mil gaya 🙏 Hamare Sales Person jaldi jawab denge. Tab tak:');
}

/** Ask the one missing thing the lead filter needs: buyer type → pieces → mobile. */
async function nextQuestion(d: SocialDeps, platform: Platform, userId: string, key: string, lead: Lead) {
  if (lead.assignedUid) return;
  if (!lead.buyerType) return void (await d.api.sendDM(platform, userId, 'Aap kis liye lena chahte hain?', askType()));
  if (lead.buyerType === 'business' && !lead.qty) return void (await d.api.sendDM(platform, userId, 'Ek design mein lagbhag kitne pieces chahiye?', askPcs()));
  if (!lead.phone) {
    await d.store.saveSocialSession(key, { state: 'phone_ask' });
    return void (await d.api.sendDM(platform, userId, 'Apna mobile number bhejein — hamare Sales Person rate aur colours ke saath call karenge 📞', []));
  }
  // still on hold after the mobile number: a GST number usually settles it for a shop
  const sess = await d.store.getSocialSession(key);
  if (lead.buyerType === 'business' && !lead.gstin && !sess.gstAsked) {
    await d.store.saveSocialSession(key, { state: 'gst_ask', gstAsked: true });
    return void (await d.api.sendDM(platform, userId, 'Shop ka GST number bhejein (ho toh) — isse aapka wholesale rate aur order jaldi confirm hota hai. 🧾', [{ title: 'GST nahi hai', payload: 'NO_GST' }]));
  }
}

async function handleComment(d: SocialDeps, platform: Platform, v: NonNullable<Change['value']>) {
  const commentId = platform === 'instagram' ? v.id : v.comment_id;
  const text = ((platform === 'instagram' ? v.text : v.message) || '').trim();
  const fromId = v.from?.id || '';
  if (!commentId || !fromId || d.ownIds.includes(fromId)) return;
  if (platform === 'facebook' && (v.item !== 'comment' || v.verb !== 'add')) return;
  if (!(await d.store.claimMessage(`${platform}_c_${commentId}`))) return;
  const cfg = await d.store.getSocialConfig();
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}₹?]+/gu, ' ').split(/\s+/);
  const hit = cfg.keywords.some((k) => words.includes(k.toLowerCase())) || text.includes('?') || text.includes('₹');
  if (!hit) return; // a normal comment ("nice 😍") — leave it

  const postId = platform === 'instagram' ? v.media?.id || '' : v.post_id || '';
  const samples = (await d.store.samples()).filter((s) => !s.isTrashed);
  const sid = postId ? await d.store.sampleForPost(postId) : null;
  const design = (sid && samples.find((s) => s.id === sid)) || findDesign(text, samples);
  const { lead } = await ensureLead(d, platform, fromId, {
    text: `Comment: ${text}`,
    source: 'comment',
    design,
    name: v.from?.name || v.from?.username || '',
    handle: v.from?.username ? `@${v.from.username}` : '',
  });
  await d.store.updateLead(lead.id, {
    notes: [...(lead.notes || []), { at: (d.now || Date.now)(), by: platform === 'instagram' ? 'Instagram comment' : 'Facebook comment', text }].slice(-30),
  });
  await screen(d, lead);
  if (!cfg.on) return;
  const ref = lead.assignedUid;
  const dm = design
    ? `Namaste 🙏 Aapne Design #${design.designNumber} ke baare mein poocha:\n\n${caption(design, true)}\n\nSaare colours dekhein aur order karein 👇\n${designUrl(d, design, platform, ref)}\n\nAap shop / boutique ke liye lena chahte hain? Reply karein *SHOP* ya *PERSONAL*, aur apna mobile number (shop ho toh GST number bhi) bhejein — hamare Sales Person call karenge.`
    : `Namaste 🙏 GFive Kolkata se. Naye designs, rate aur order yahan 👇\n${bioUrl(d, platform, ref)}\n\nShop / boutique ke liye? Reply karein *SHOP* ya *PERSONAL*, aur design no., mobile number ya GST number bhejein.`;
  await d.api.privateReply(commentId, dm).catch((e) => console.error('private reply', e));
  await d.api.publicReply(platform, commentId, 'Aapko DM kiya hai 🙏 Please check your messages.').catch((e) => console.error('public reply', e));
}

/** Entry point for the Meta webhook (object = "instagram" or "page"). */
export async function handleMetaWebhook(body: MetaWebhookBody, d: SocialDeps) {
  const platform: Platform | null = body.object === 'instagram' ? 'instagram' : body.object === 'page' ? 'facebook' : null;
  if (!platform) return;
  for (const entry of body.entry || []) {
    for (const e of entry.messaging || []) await handleDM(d, platform, e).catch((err) => console.error('social dm', err));
    for (const ch of entry.changes || []) {
      if ((platform === 'instagram' && ch.field === 'comments') || (platform === 'facebook' && ch.field === 'feed')) {
        if (ch.value) await handleComment(d, platform, ch.value).catch((err) => console.error('social comment', err));
      }
    }
  }
}

/** Caption for an Instagram / Facebook post of a design. */
export function postCaption(s: Sample, opts: { showRate: boolean; siteUrl: string; company: string; instagram?: string }) {
  const cat = categoryName(s.category);
  const tags = ['#GFive', '#UnstitchedSuits', '#SuitWholesale', '#KolkataFashion', cat ? `#${cat}Collection` : '', '#SalwarSuit', '#DesignerSuits'].filter(Boolean).join(' ');
  const lines: (string | null)[] = [
    `✨ ${cat ? `${cat} Collection` : 'New design'} · Design #${s.designNumber}`,
    s.fabric ? `🧵 Fabric: ${s.fabric}` : null,
    s.work ? `🪡 Work: ${s.work}` : null,
    opts.showRate ? `💰 Rate: ${inr(s.price)}/pc (wholesale)` : '💬 Rate ke liye comment karein "PRICE" — hum DM kar denge',
    s.aiImages?.includes(samplePhotos(s)[0]) ? '📸 AI generated model look — actual fabric & work as per design' : null,
    '',
    '🛒 Order / all colours: link in bio',
    `📍 ${opts.company}`,
    '',
    tags,
  ];
  return lines
    .filter((x): x is string => x !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}
