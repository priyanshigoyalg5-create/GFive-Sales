/* Run: npx tsx --test tests/social.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleMetaWebhook, postCaption, type SocialApi } from '../lib/social/handler';
import type { SocialStore, SocialSession } from '../lib/whatsapp/store';
import type { Lead } from '../lib/leads';
import type { Sample } from '../lib/types';
import { DEFAULT_SETTINGS } from '../lib/settings-defaults';
import { DEFAULT_KEYWORDS } from '../lib/whatsapp/store';

function world(on = true) {
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
    async getSettings() { return { ...DEFAULT_SETTINGS, whatsappNumber: '917044440614' }; },
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
  } satisfies SocialStore;
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

test('Instagram DM "hi" → lead (Instagram, handle) + menu with quick replies', async () => {
  const w = world();
  await handleMetaWebhook(igDM('hi'), w.deps);
  const l = [...w.leads.values()][0];
  assert.equal(l.source, 'instagram');
  assert.equal(l.handle, '@meenaboutique');
  assert.equal(l.assignedUid, 'u3');
  const dm = w.calls.find((c) => c.fn === 'sendDM')!;
  assert.equal(dm.args[0], 'instagram');
  assert.ok((dm.args[3] as unknown[]).length >= 3);
});

test('DM with a design number → photo + details + order link with ref & from', async () => {
  const w = world();
  await handleMetaWebhook(igDM('RZ0138 price?'), w.deps);
  assert.ok(w.calls.some((c) => c.fn === 'sendDMImage'));
  const t = String(w.calls.filter((c) => c.fn === 'sendDM').pop()!.args[2]);
  assert.match(t, /Design #RZ0138[\s\S]*\/s\/s2\?ref=u3&from=instagram/);
});

test('DM with mobile number saves the phone on the lead', async () => {
  const w = world();
  await handleMetaWebhook(igDM('hi'), w.deps);
  await handleMetaWebhook(igDM('mera number 98300 12345'), w.deps);
  const l = [...w.leads.values()][0];
  assert.equal(l.phone, '919830012345');
  assert.equal(w.leads.size, 1);
});

test('Instagram comment "price" on a posted design → private DM with that design + public reply + comment lead', async () => {
  const w = world();
  await handleMetaWebhook({ object: 'instagram', entry: [{ id: 'IG1', changes: [{ field: 'comments', value: { id: 'C1', text: 'Price pls', from: { id: 'U7', username: 'rahul_tex' }, media: { id: 'IGMEDIA1' } } }] }] }, w.deps);
  const pr = w.calls.find((c) => c.fn === 'privateReply')!;
  assert.equal(pr.args[0], 'C1');
  assert.match(String(pr.args[1]), /Design #RZ0138[\s\S]*\/s\/s2\?ref=u3&from=instagram/);
  assert.ok(w.calls.some((c) => c.fn === 'publicReply' && c.args[1] === 'C1'));
  const l = [...w.leads.values()][0];
  assert.equal(l.source, 'comment');
  assert.equal(l.handle, '@rahul_tex');
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
