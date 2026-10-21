/* Run: npx tsx --test tests/social.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleMetaWebhook, postCaption, type SocialApi } from '../lib/social/handler';
import type { SocialStore, SocialSession } from '../lib/whatsapp/store';
import type { Lead } from '../lib/leads';
import type { Sample } from '../lib/types';
import { DEFAULT_SETTINGS } from '../lib/settings-defaults';
import { DEFAULT_KEYWORDS } from '../lib/whatsapp/store';
import { DEFAULT_FILTER, type LeadFilter } from '../lib/leads';

function world(on = true, filter: Partial<LeadFilter> = {}, extra: Partial<SocialStore> = {}) {
  const leads = new Map<string, Lead>();
  const sess = new Map<string, SocialSession>();
  const seen = new Set<string>();
  let n = 0;
  const samples: Sample[] = [
    { id: 's2', designNumber: 'RZ0138', price: 1595, category: 'rozana', fabric: 'Raw silk', imageUrl: 'https://res.cloudinary.com/x/image/upload/b.jpg' },
  ];
  const store = {
    async claimMessage(id: string) { if (seen.has(id)) return false; seen.add(id); return true; },
    async getConfig() { return { on: true, testNumbers: [], provider: 'meta' as const }; },
    async getSettings() { return { ...DEFAULT_SETTINGS, whatsappNumber: '917044440614', website: 'gfive.co.in' }; },
    async getSession() { return {}; },
    async saveSession() {},
    async samples() { return samples; },
    async ordersByPhone() { return []; },
    async team() { return [{ uid: 'u3', name: 'Priya', whatsappNumber: '919000000003', active: true }]; },
    async receivers() { return []; },
    async openLeadCounts() { return new Map(); },
    async getLead(id: string) { return leads.get(id) || null; },
    async createLead(d: Omit<Lead, 'id'>) { const id = 'L' + ++n; leads.set(id, { ...(d as Lead), id }); return id; },
    async updateLead(id: string, p: Partial<Lead>) { leads.set(id, { ...(leads.get(id) as Lead), ...p }); },
    async getSocialConfig() { return { on, keywords: DEFAULT_KEYWORDS, showRate: false }; },
    async getSocialSession(k: string) { return { ...(sess.get(k) || {}) }; },
    async saveSocialSession(k: string, p: Partial<SocialSession>) { const c = { ...(sess.get(k) || {}), ...p }; if (p.state === '') delete c.state; sess.set(k, c); },
    async sampleForPost(id: string) { return id === 'IGMEDIA1' ? 's2' : null; },
    async savePost() {},
    async getLeadFilter() { return { ...DEFAULT_FILTER, ...filter }; },
  } satisfies SocialStore;
  Object.assign(store, extra);
  const calls: { fn: string; args: unknown[] }[] = [];
  const rec = (fn: string) => async (...args: unknown[]) => { calls.push({ fn, args }); return {}; };
  const api: SocialApi = {
    sendDM: rec('sendDM') as SocialApi['sendDM'],
    sendDMImage: rec('sendDMImage') as SocialApi['sendDMImage'],
    privateReply: rec('privateReply') as SocialApi['privateReply'],
    publicReply: rec('publicReply') as SocialApi['publicReply'],
    profileName: async () => ({ name: 'Meena', handle: '@meenaboutique' }),
  };
  const deps = { store, api, siteUrl: 'https://gfivesales.vercel.app', ownIds: ['PAGE1', 'IG1'] };
  return { leads, calls, deps };
}

const igDM = (text: string, mid = 'm' + Math.random()) => ({ object: 'instagram', entry: [{ id: 'IG1', messaging: [{ sender: { id: 'IGSID9' }, recipient: { id: 'IG1' }, message: { mid, text } }] }] });

const tap = (payload: string, title = payload) => ({ object: 'instagram', entry: [{ messaging: [{ sender: { id: 'IGSID9' }, message: { mid: 'q' + Math.random(), text: title, quick_reply: { payload } } }] }] });
const dmTexts = (w: ReturnType<typeof world>) => w.calls.filter((c) => c.fn === 'sendDM').map((c) => String(c.args[2]));
const lastDM = (w: ReturnType<typeof world>) => w.calls.filter((c) => c.fn === 'sendDM').pop()!;

test('Instagram "hi" → lead ON HOLD (no mobile yet), not given to a Sales Person', async () => {
  const w = world();
  await handleMetaWebhook(igDM('hi'), w.deps);
  const l = [...w.leads.values()][0];
  assert.equal(l.source, 'instagram');
  assert.equal(l.handle, '@meenaboutique');
  assert.equal(l.assignedUid, '');
  assert.equal(l.holdReason, 'Waiting for mobile number');
  assert.ok((lastDM(w).args[3] as unknown[]).length >= 3); // menu
});

test('qualifying chat: shop → pieces → mobile → given to Sales Person with thank-you', async () => {
  const w = world();
  await handleMetaWebhook(igDM('hi'), w.deps);
  await handleMetaWebhook(tap('NEW', '🆕 Naye designs'), w.deps);
  assert.match(dmTexts(w).pop()!, /kis liye/); // asks buyer type
  await handleMetaWebhook(tap('BIZ', '🏬 Shop / boutique'), w.deps);
  assert.match(dmTexts(w).pop()!, /kitne pieces/);
  await handleMetaWebhook(tap('Q_MID', '10–49 pcs'), w.deps);
  assert.match(dmTexts(w).pop()!, /mobile number/);
  assert.equal([...w.leads.values()][0].assignedUid, '');
  await handleMetaWebhook(igDM('9830012345'), w.deps);
  const l = [...w.leads.values()][0];
  assert.equal(l.assignedUid, 'u3');
  assert.equal(l.buyerType, 'business');
  assert.equal(l.qty, 20);
  assert.equal(l.phone, '919830012345');
  assert.match(dmTexts(w).pop()!, /Priya aapko \+919830012345 par jaldi call karenge/);
});

test('personal buyer → polite reply with retail store, stays on hold', async () => {
  const w = world();
  await handleMetaWebhook(igDM('hi'), w.deps);
  await handleMetaWebhook(tap('PERSONAL', '🙋 Apne liye'), w.deps);
  const l = [...w.leads.values()][0];
  assert.equal(l.assignedUid, '');
  assert.match(dmTexts(w).pop()!, /wholesale[\s\S]*gfive\.co\.in/);
});

test('settings can send personal buyers to one person', async () => {
  const w = world(true, { personal: 'give', personalTo: 'u3', needPhone: false, minScore: 0 });
  await handleMetaWebhook(igDM('apne liye ek suit chahiye'), w.deps);
  assert.equal([...w.leads.values()][0].assignedUid, 'u3');
});

test('DM with a design number → photo + details + order link, then asks buyer type', async () => {
  const w = world();
  await handleMetaWebhook(igDM('RZ0138 price?'), w.deps);
  assert.ok(w.calls.some((c) => c.fn === 'sendDMImage'));
  const t = dmTexts(w);
  assert.ok(t.some((x) => /Design #RZ0138[\s\S]*\/s\/s2\?from=instagram/.test(x)));
  assert.match(t.pop()!, /kis liye/);
});

test('free text "shop hai, 50 pcs, 9830099999" qualifies in one message', async () => {
  const w = world();
  await handleMetaWebhook(igDM('RZ0138 boutique ke liye 50 pcs chahiye 9830099999'), w.deps);
  const l = [...w.leads.values()][0];
  assert.equal(l.assignedUid, 'u3');
  assert.equal(l.qty, 50);
});

test('Instagram comment "price" on a posted design → private DM asks SHOP/PERSONAL + public reply; lead on hold', async () => {
  const w = world();
  await handleMetaWebhook({ object: 'instagram', entry: [{ id: 'IG1', changes: [{ field: 'comments', value: { id: 'C1', text: 'Price pls', from: { id: 'U7', username: 'rahul_tex' }, media: { id: 'IGMEDIA1' } } }] }] }, w.deps);
  const pr = w.calls.find((c) => c.fn === 'privateReply')!;
  assert.equal(pr.args[0], 'C1');
  assert.match(String(pr.args[1]), /Design #RZ0138[\s\S]*\/s\/s2\?from=instagram[\s\S]*SHOP/);
  assert.ok(w.calls.some((c) => c.fn === 'publicReply' && c.args[1] === 'C1'));
  const l = [...w.leads.values()][0];
  assert.equal(l.source, 'comment');
  assert.equal(l.assignedUid, '');
  assert.equal(l.holdReason, 'Waiting for mobile number');
});

test('normal comment ("nice 😍") and our own comments are ignored; duplicates once', async () => {
  const w = world();
  await handleMetaWebhook({ object: 'instagram', entry: [{ changes: [{ field: 'comments', value: { id: 'C2', text: 'nice 😍', from: { id: 'U8' } } }] }] }, w.deps);
  await handleMetaWebhook({ object: 'instagram', entry: [{ changes: [{ field: 'comments', value: { id: 'C3', text: 'price', from: { id: 'IG1' } } }] }] }, w.deps);
  assert.equal(w.calls.length, 0);
  const fb = { object: 'page', entry: [{ changes: [{ field: 'feed', value: { item: 'comment', verb: 'add', comment_id: 'F1', message: 'rate?', from: { id: 'P5', name: 'Anil' }, post_id: 'X' } }] }] };
  await handleMetaWebhook(fb, w.deps);
  await handleMetaWebhook(fb, w.deps);
  assert.equal(w.calls.filter((c) => c.fn === 'privateReply').length, 1);
  assert.equal([...w.leads.values()][0].name, 'Anil');
});

test('auto-replies off: leads still recorded, nothing sent', async () => {
  const w = world(false);
  await handleMetaWebhook(igDM('hi'), w.deps);
  assert.equal(w.leads.size, 1);
  assert.equal(w.calls.length, 0);
});

test('post caption hides rate by default and invites PRICE comments', () => {
  const c = postCaption({ id: 's', designNumber: 'RZ0138', price: 1595, category: 'rozana', fabric: 'Raw silk' } as Sample, { showRate: false, siteUrl: '', company: 'GFive Kolkata' });
  assert.match(c, /Rozana Collection · Design #RZ0138/);
  assert.match(c, /comment karein "PRICE"/);
  assert.doesNotMatch(c, /₹1,595/);
  assert.match(c, /\n\n🛒 Order/);
});

// ---------------------------------------------------------------- GST
const GOOD_GST = '29AAICP2912R1ZR'; // valid check digit (Cashfree docs example)

test('held shop lead is asked for GST; a valid GST number sends it straight to a Sales Person', async () => {
  const w = world(true, { minScore: 80 });
  await handleMetaWebhook(igDM('hi'), w.deps);
  await handleMetaWebhook(tap('BIZ'), w.deps);
  await handleMetaWebhook(tap('Q_SMALL'), w.deps);
  await handleMetaWebhook(igDM('9830012345'), w.deps);
  assert.equal([...w.leads.values()][0].assignedUid, '');
  assert.match(dmTexts(w).pop()!, /GST number/);
  await handleMetaWebhook(igDM(`mera gst ${GOOD_GST.toLowerCase()}`), w.deps);
  const l = [...w.leads.values()][0];
  assert.equal(l.gstin, GOOD_GST);
  assert.equal(l.assignedUid, 'u3');
  assert.match(dmTexts(w).pop()!, /Priya/);
});

test('wrong GST number → asked again, not saved', async () => {
  const w = world();
  await handleMetaWebhook(igDM('hi'), w.deps);
  await handleMetaWebhook(igDM('29AAICP2912R1ZX'), w.deps);
  assert.match(dmTexts(w).pop()!, /sahi nahi/);
  assert.equal([...w.leads.values()][0].gstin, undefined);
});

test('online check: cancelled GST is held even with mobile', async () => {
  const w = world(true, { gstOnline: true }, {
    async checkGst() { return { found: true, active: false, status: 'Cancelled', legalName: 'X', tradeName: '', type: '', city: '', nameMatch: false, at: 1 }; },
  });
  await handleMetaWebhook(igDM(`shop hai 9830012345 ${GOOD_GST}`), w.deps);
  const l = [...w.leads.values()][0];
  assert.equal(l.assignedUid, '');
  assert.equal(l.holdReason, 'GST Cancelled');
});

test('Instagram profile + ad referral are saved on the lead', async () => {
  const w = world();
  w.deps.api.profileName = async () => ({ name: 'Meena', handle: '@meenaboutique', followers: 4200, followsUs: true });
  await handleMetaWebhook({ object: 'instagram', entry: [{ messaging: [{ sender: { id: 'IGSID9' }, message: { mid: 'ad1', text: 'price?', referral: { source: 'ADS', ad_id: '6001' } } }] }] }, w.deps);
  const l = [...w.leads.values()][0];
  assert.deepEqual([l.igFollowers, l.followsUs, l.fromAd], [4200, true, '6001']);
});
