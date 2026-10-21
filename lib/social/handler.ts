/**
 * Instagram & Facebook: DMs and post comments → Leads + automatic replies.
 *
 *  • DM ("Price?", "RZ0138", "hi") → lead for one Sales Person + reply with design / links.
 *  • Comment with a keyword ("price", "rate", "pp", "details"…) → ONE private DM with the
 *    design details & order link, a short public reply "DM kiya hai 🙏", and a lead.
 */
import { categoryName } from '../categories';
import { inr } from '../format';
import { buildLeadContext, pickAssignee, type Lead } from '../leads';
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
  const [team, receivers, openCount] = await Promise.all([d.store.team(), d.store.receivers(), d.store.openLeadCounts()]);
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
    assignedUid: '',
    assignedName: '',
    notes: [],
  };
  const who = pickAssignee(draft, buildLeadContext([], []), team, receivers, openCount);
  const lead = { ...draft, assignedUid: who?.uid || '', assignedName: who?.name || '', assignReason: who ? `Auto · ${who.reason}` : '' };
  const id = await d.store.createLead({ ...lead, socialId: `${platform}:${userId}` } as unknown as Omit<Lead, 'id'>);
  await d.store.saveSocialSession(key, { leadId: id, name: lead.name, updatedAt: (d.now || Date.now)() });
  return { lead: { ...lead, id }, key, sess, created: true };
}

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
  const design = text ? findDesign(text, samples) : null;

  const { lead, key, sess, created } = await ensureLead(d, platform, userId, { text, source: platform, design });
  const notes = [...(lead.notes || []), { at: (d.now || Date.now)(), by: platform === 'instagram' ? 'Instagram DM' : 'Messenger', text: text || '[photo / sticker]' }].slice(-30);
  const phone = PHONE.exec(text)?.[1]?.replace(/\D/g, '');
  await d.store.updateLead(lead.id, { notes, ...(design ? { designId: design.id, designNumber: String(design.designNumber), category: design.category || '' } : {}), ...(phone ? { phone: `91${phone}` } : {}) });
  if (!cfg.on) return; // leads still recorded; no automatic answer

  const ref = lead.assignedUid;
  const say = (t: string, q: QuickReply[] = menu()) => d.api.sendDM(platform, userId, t, q);

  if (phone) {
    await d.store.saveSocialSession(key, { state: '' });
    return void (await say(`Shukriya 🙏 ${lead.assignedName || 'Hamare Sales Person'} aapko +91 ${phone} par jaldi call karenge.`, []));
  }
  if (sess.state === 'phone_ask' && text) {
    await d.store.saveSocialSession(key, { state: '' });
    return void (await say('Mobile number 10 digit mein bhejein (jaise 98xxxxxxxx), taaki hum call kar sakein.', []));
  }
  if (design) {
    const ph = samplePhotos(design)[0];
    if (ph) await d.api.sendDMImage(platform, userId, ph.replace('/upload/', '/upload/w_1080,h_1350,c_limit,f_jpg,q_80/')).catch(() => {});
    return void (await say(`${caption(design, true)}\n\nSaare colours dekhein aur order karein 👇\n${designUrl(d, design, platform, ref)}`));
  }
  switch (payload) {
    case 'NEW':
      return void (await say(`✨ Naye designs (photo, rate, order) yahan dekhein 👇\n${bioUrl(d, platform, ref)}`));
    case 'RATE':
      return void (await say('Design no. bhejein (jaise RZ0138), ya post ka screenshot bhejein — hum rate aur colours bata denge.', []));
    case 'CALL':
      await d.store.saveSocialSession(key, { state: 'phone_ask' });
      return void (await say('Apna mobile number bhejein, hamare Sales Person call karenge 📞', []));
    case 'WA': {
      const team = await d.store.team();
      const sp = team.find((t) => t.uid === lead.assignedUid);
      const st = await d.store.getSettings();
      const wa = sp?.whatsappNumber || st.whatsappNumber;
      return void (await say(`WhatsApp par baat karein 👇\nhttps://wa.me/${wa}`, []));
    }
  }
  if (created || /^(hi+|hello|hey|namaste|menu|start)\b/i.test(text)) {
    return void (await say(`Namaste 🙏 GFive Kolkata — designer unstitched suits (wholesale).\nKya dekhna hai?`));
  }
  await say('Aapka message mil gaya 🙏 Hamare Sales Person jaldi jawab denge. Tab tak:');
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
  if (!cfg.on) return;
  const ref = lead.assignedUid;
  const dm = design
    ? `Namaste 🙏 Aapne Design #${design.designNumber} ke baare mein poocha:\n\n${caption(design, true)}\n\nSaare colours dekhein aur order karein 👇\n${designUrl(d, design, platform, ref)}\n\nMobile number bhejein toh ${lead.assignedName || 'hamare Sales Person'} call karenge.`
    : `Namaste 🙏 GFive Kolkata se. Naye designs, rate aur order yahan 👇\n${bioUrl(d, platform, ref)}\n\nDesign no. ya mobile number bhejein, hum turant bata denge.`;
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
