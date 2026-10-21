/* Run: npx tsx --test tests/gst.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGstin, findGstin, gstLevel, namesMatch, type GstCheck } from '../lib/gst';
import { DEFAULT_FILTER, buildLeadContext, qualifies, scoreLead, type Lead } from '../lib/leads';
import { _setGstFetch, verifyGstOnline } from '../lib/server/gst-verify';

const OK = '29AAICP2912R1ZR';
const chk = (p: Partial<GstCheck>): GstCheck => ({ found: true, active: true, status: 'Active', legalName: '', tradeName: '', type: '', city: '', nameMatch: true, at: 1, ...p });

test('valid GSTIN: state, PAN, holder', () => {
  const g = checkGstin(' 29aaicp2912r1zr ');
  assert.equal(g.ok, true);
  assert.equal(g.state, 'Karnataka');
  assert.equal(g.pan, 'AAICP2912R');
  assert.equal(g.holder, 'Company');
  assert.equal(checkGstin('27AAPFU0939F1ZV').ok, true);
});
test('typos and fakes are caught', () => {
  assert.match(checkGstin('29AAICP2912R1ZX').reason!, /check digit/);
  assert.match(checkGstin('29AAICP2912R1Z').reason!, /15 characters/);
  assert.match(checkGstin('00AAICP2912R1ZR').reason!, /state code/);
  assert.match(checkGstin('29AAIC12912R1ZR').reason!, /format/);
});
test('finds a GSTIN inside a chat message', () => {
  assert.equal(findGstin('gst no 29 AAICP 2912 R1ZR hai'), OK);
  assert.equal(findGstin('9830012345'), '');
});
test('name matching is loose but not random', () => {
  assert.equal(namesMatch(['Shree Fashion'], ['SHREE FASHIONS PRIVATE LIMITED']), true);
  assert.equal(namesMatch(['M/s Ujjivan Bank'], ['UJJIVAN SMALL FINANCE BANK LIMITED']), true);
  assert.equal(namesMatch(['Meena Boutique'], ['RAJ TEXTILES']), false);
});
test('levels', () => {
  assert.equal(gstLevel('', null), 'none');
  assert.equal(gstLevel('29AAICP2912R1ZX', null), 'invalid');
  assert.equal(gstLevel(OK, null), 'valid');
  assert.equal(gstLevel(OK, chk({})), 'verified');
  assert.equal(gstLevel(OK, chk({ nameMatch: false })), 'mismatch');
  assert.equal(gstLevel(OK, chk({ active: false, status: 'Cancelled' })), 'inactive');
  assert.equal(gstLevel(OK, chk({ found: false })), 'notfound');
});

const base: Lead = { id: 'x', name: 'A', phone: '919830012345', source: 'instagram', status: 'new', assignedUid: '', assignedName: '' };
const q = (l: Partial<Lead>, f = DEFAULT_FILTER) => { const L = { ...base, ...l }; return qualifies(L, scoreLead(L, buildLeadContext([], [])), f); };

test('filter: valid GST + mobile passes even with a low score', () => {
  assert.match(q({ message: 'hi' }, { ...DEFAULT_FILTER, minScore: 90 }).reason, /Low score/);
  assert.equal(q({ message: 'hi', gstin: OK }, { ...DEFAULT_FILTER, minScore: 90 }).ok, true);
});
test('filter: GST without mobile still waits for mobile', () => assert.match(q({ phone: '', message: 'rate?', gstin: OK }).reason, /mobile/));
test('filter: online on → only verified passes directly; cancelled / not found held', () => {
  const f = { ...DEFAULT_FILTER, gstOnline: true, minScore: 90 };
  assert.equal(q({ gstin: OK, gstCheck: chk({}) }, f).ok, true);
  assert.match(q({ gstin: OK, gstCheck: chk({ nameMatch: false }) }, f).reason, /Low score/);
  assert.equal(q({ gstin: OK, gstCheck: chk({ active: false, status: 'Cancelled' }) }, f).reason, 'GST Cancelled');
  assert.equal(q({ gstin: OK, gstCheck: chk({ found: false }) }, f).reason, 'GST number not found');
});
test('filter: "shops must give GST"', () => {
  const f = { ...DEFAULT_FILTER, needGst: true, minScore: 0 };
  assert.equal(q({ buyerType: 'business' }, f).reason, 'Waiting for GST number');
  assert.equal(q({ buyerType: 'business', gstin: OK }, f).ok, true);
});
test('score: verified GST is a big plus, cancelled a minus', () => {
  const s = (l: Partial<Lead>) => scoreLead({ ...base, ...l }).score;
  assert.ok(s({ gstin: OK, gstCheck: chk({}) }) > s({ gstin: OK }));
  assert.ok(s({ gstin: OK }) > s({}));
  assert.ok(s({ gstin: OK, gstCheck: chk({ active: false }) }) < s({}));
});

test('Cashfree response is read correctly', async () => {
  process.env.CASHFREE_CLIENT_ID = 'id';
  process.env.CASHFREE_CLIENT_SECRET = 'secret';
  let sent: { url: string; headers: Record<string, string>; body: string } | null = null;
  _setGstFetch((async (url: string, init: RequestInit) => {
    sent = { url, headers: init.headers as Record<string, string>, body: String(init.body) };
    return new Response(JSON.stringify({ GSTIN: OK, legal_name_of_business: 'UJJIVAN SMALL FINANCE BANK LIMITED', trade_name_of_business: 'UJJIVAN SMALL FINANCE BANK', gst_in_status: 'Active', constitution_of_business: 'Public Limited Company', principal_place_split_address: { city: 'Dispur' }, valid: true, message: 'GSTIN Exists' }), { status: 200 });
  }) as typeof fetch);
  const c = await verifyGstOnline(OK, ['Ujjivan Bank']);
  assert.equal(sent!.url, 'https://api.cashfree.com/verification/gstin');
  assert.equal(sent!.headers['x-client-id'], 'id');
  assert.equal(JSON.parse(sent!.body).GSTIN, OK);
  assert.deepEqual([c.found, c.active, c.nameMatch, c.city], [true, true, true, 'Dispur']);
  _setGstFetch((async () => new Response(JSON.stringify({ reference_id: 20, GSTIN: OK, message: "GSTIN Doesn't Exist" }), { status: 200 })) as unknown as typeof fetch);
  const n = await verifyGstOnline(OK, ['X']);
  assert.deepEqual([n.found, n.active], [false, false]);
});
