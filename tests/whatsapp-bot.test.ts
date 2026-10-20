/* Run: npx tsx --test tests/whatsapp-bot.test.ts  (no network, in-memory store) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle, findDesign, STATE_TTL_MS, type Incoming } from '../lib/whatsapp/bot';
import type { BotStore, WaSession } from '../lib/whatsapp/store';
import type { Lead } from '../lib/leads';
import type { Order, PublicStaff, Sample } from '../lib/types';
import { DEFAULT_SETTINGS } from '../lib/settings-defaults';
import { validSignature } from '../lib/whatsapp/signature';
import crypto from 'node:crypto';

const ts = (ms: number) => ({ toMillis: () => ms, toDate: () => new Date(ms) });

function world(opts: { on?: boolean; tests?: string[] } = {}) {
  const sessions = new Map<string, WaSession>();
  const leads = new Map<string, Lead>();
  const seen = new Set<string>();
  let n = 0;
  const samples: Sample[] = [
    { id: 's1', designNumber: 'SD11070', price: 2995, category: 'tyohaar', fabric: 'Muslin silk', work: 'Mirror', imageUrl: 'https://res.cloudinary.com/x/image/upload/a.jpg', createdByUid: 'u2' },
    { id: 's2', designNumber: 'RZ0138', price: 1595, category: 'rozana', imageUrl: 'https://res.cloudinary.com/x/image/upload/b.jpg', createdByUid: 'u3' },
    { id: 's3', designNumber: 'RZ0200', price: 1695, category: 'rozana' },
    { id: 's4', designNumber: 'RZ0300', price: 1795, category: 'rozana' },
    { id: 's5', designNumber: 'RZ0400', price: 1895, category: 'rozana' },
  ];
  const orders: Order[] = [
    { id: 'o1', orderId: 'GFive#23', firmName: 'Shree Laxmi', mobile: '9830012345', city: 'Surat', totalQuantity: 16, totalAmount: 41920, status: 'Dispatched', salesPersonUid: 'u2', salesPersonName: 'Samrat', designNumber: 'SD11070' } as Order,
  ];
  const team: PublicStaff[] = [
    { uid: 'u2', name: 'Samrat', whatsappNumber: '919000000002', active: true },
    { uid: 'u3', name: 'Priya', whatsappNumber: '919000000003', active: true },
  ];
  const store: BotStore = {
    async claimMessage(id) { if (seen.has(id)) return false; seen.add(id); return true; },
    async getConfig() { return { on: opts.on ?? true, testNumbers: opts.tests || [] }; },
    async getSettings() { return { ...DEFAULT_SETTINGS, companyName: 'GFive Kolkata', addressLine: '113 Park Street', whatsappNumber: '917044440614' }; },
    async getSession(p) { return { ...(sessions.get(p) || {}) }; },
    async saveSession(p, patch) { const cur = { ...(sessions.get(p) || {}), ...patch }; if (patch.state === '') { delete cur.state; delete cur.stateAt; } sessions.set(p, cur); },
    async samples() { return samples; },
    async ordersByPhone(p) { const ten = p.slice(-10); return orders.filter((o) => o.mobile.slice(-10) === ten); },
    async team() { return team; },
    async receivers() { return ['u3']; },
    async openLeadCounts() { return new Map(); },
    async getLead(id) { return leads.get(id) || null; },
    async createLead(d) { const id = 'L' + ++n; leads.set(id, { ...(d as Lead), id, createdAt: ts(Date.now()) as never }); return id; },
    async updateLead(id, p) { leads.set(id, { ...(leads.get(id) as Lead), ...p }); },
  };
  const sent: { to: string; p: Record<string, any> }[] = [];
  let mid = 0;
  let clock = Date.now();
  const deps = { store, send: async (to: string, p: Record<string, unknown>) => { sent.push({ to, p: p as any }); return 'x'; }, siteUrl: 'https://gfivesales.vercel.app', now: () => clock };
  const msg = (from: string, body: Partial<Incoming>): Incoming => ({ id: 'wamid.' + ++mid, from, type: 'text', ...body } as Incoming);
  const say = (from: string, text: string, name = 'Ramesh') => handle(msg(from, { type: 'text', text: { body: text } }), name, deps);
  const tap = (from: string, id: string) => handle(msg(from, { type: 'interactive', interactive: { type: 'list_reply', list_reply: { id, title: id } } }), 'Ramesh', deps);
  return { store, sessions, leads, sent, say, tap, deps, msg, advance: (ms: number) => (clock += ms) };
}
const last = (w: ReturnType<typeof world>) => w.sent[w.sent.length - 1].p;
const bodyOf = (p: any) => p.text?.body || p.interactive?.body?.text || '';

test('hi → main menu with 6 options, and a lead is created via rotation', async () => {
  const w = world();
  await w.say('919000011111', 'Hi');
  const p = last(w);
  assert.equal(p.interactive.type, 'list');
  assert.equal(p.interactive.action.sections[0].rows.length, 6);
  assert.equal(p.interactive.action.button, 'Select');
  const l = [...w.leads.values()][0];
  assert.equal(l.source, 'whatsapp');
  assert.equal(l.phone, '919000011111');
  assert.equal(l.assignedUid, 'u3'); // only receiver
  assert.match(l.assignReason || '', /rotation/);
});

test('existing customer → lead goes to their last Sales Person; my orders shows status', async () => {
  const w = world();
  await w.say('919830012345', 'hello');
  assert.equal([...w.leads.values()][0].assignedUid, 'u2');
  await w.tap('919830012345', 'm:mine');
  assert.match(bodyOf(last(w)), /GFive#23.*\n16 pcs · ₹41,920 · \*Dispatched\*/);
});

test('new designs → category → 3 photo cards with Order button + more', async () => {
  const w = world();
  await w.say('919000011111', 'hi');
  await w.tap('919000011111', 'm:new');
  w.sent.length = 0;
  await w.tap('919000011111', 'cat:rozana:0');
  const cards = w.sent.slice(0, 3).map((s) => s.p);
  assert.equal(cards.length, 3);
  assert.equal(cards[0].interactive.header.type, 'image');
  assert.match(cards[0].interactive.header.image.link, /w_1080/);
  assert.equal(cards[0].interactive.action.buttons[0].reply.id, 'order:s2');
  assert.match(bodyOf(cards[0]), /Design #RZ0138.*Rozana\nRate: \*₹1,595\/pc\*/);
  const nav = last(w);
  assert.equal(nav.interactive.action.buttons[0].reply.id, 'cat:rozana:3');
});

test('order button → link with Sales Person ref; lead becomes interested', async () => {
  const w = world();
  await w.say('919000011111', 'hi');
  await w.tap('919000011111', 'order:s1');
  assert.match(bodyOf(last(w)), /https:\/\/gfivesales\.vercel\.app\/s\/s1\?ref=u3/);
  const l = [...w.leads.values()][0];
  assert.equal(l.status, 'interested');
  assert.equal(l.designId, 's1');
});

test('typing a design number shows that design', async () => {
  const w = world();
  await w.say('919000011111', 'RZ0138 ka rate kya hai?');
  // first message: lead created with the design
  assert.equal([...w.leads.values()][0].designId, 's2');
  await w.say('919000011111', 'SD11070 chahiye');
  assert.match(bodyOf(last(w)), /Design #SD11070/);
  assert.ok(findDesign('rz0138?', [{ id: 'a', designNumber: 'RZ0138', price: 1 } as Sample]));
});

test('customer care: next message becomes a care lead for their Sales Person', async () => {
  const w = world();
  await w.say('919830012345', 'hi');
  await w.tap('919830012345', 'm:care');
  await w.say('919830012345', 'Order GFive#23 mein 2 pcs kam aaye');
  const care = [...w.leads.values()].find((l) => l.kind === 'care')!;
  assert.ok(care);
  assert.equal(care.assignedUid, 'u2');
  assert.match(care.message || '', /2 pcs kam/);
  assert.match(bodyOf(last(w)), /note ho gayi/);
});

test('unfinished complaint expires after 1 hour', async () => {
  const w = world();
  await w.say('919000011111', 'hi');
  await w.tap('919000011111', 'm:care');
  w.advance(STATE_TTL_MS + 1000);
  await w.say('919000011111', 'menu');
  assert.equal([...w.leads.values()].filter((l) => l.kind === 'care').length, 0);
  assert.equal(last(w).interactive.type, 'list');
});

test('Sales Person button gives their WhatsApp', async () => {
  const w = world();
  await w.say('919830012345', 'hi');
  await w.tap('919830012345', 'm:sp');
  assert.match(bodyOf(last(w)), /Samrat[\s\S]*wa\.me\/919000000002/);
});

test('same message twice (Meta retry) is handled once', async () => {
  const w = world();
  const m = w.msg('919000011111', { type: 'text', text: { body: 'hi' } });
  await handle(m, 'R', w.deps);
  await handle(m, 'R', w.deps);
  assert.equal(w.sent.length, 1);
});

test('bot off, and test mode, stay silent', async () => {
  const off = world({ on: false });
  await off.say('919000011111', 'hi');
  assert.equal(off.sent.length, 0);
  const tm = world({ tests: ['9830012345'] });
  await tm.say('919000011111', 'hi');
  assert.equal(tm.sent.length, 0);
  await tm.say('919830012345', 'hi');
  assert.equal(tm.sent.length, 1);
});

test('STOP / START', async () => {
  const w = world();
  await w.say('919000011111', 'STOP');
  assert.match(bodyOf(last(w)), /START/);
  const before = w.sent.length;
  await w.say('919000011111', 'hi');
  assert.equal(w.sent.length, before);
  await w.say('919000011111', 'START');
  assert.equal(w.sent.length, before + 1);
});

test('webhook signature check', () => {
  const raw = '{"a":1}';
  const sig = 'sha256=' + crypto.createHmac('sha256', 'sec').update(raw).digest('hex');
  assert.equal(validSignature(raw, sig, 'sec'), true);
  assert.equal(validSignature(raw, sig, 'other'), false);
  assert.equal(validSignature(raw, null, 'sec'), false);
});
