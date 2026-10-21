/* Run: npx tsx --test tests/leads.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FILTER, assignWithFilter, buildLeadContext, qualifies, scoreLead, type Lead } from '../lib/leads';

const base: Lead = { id: 'x', name: 'A', phone: '', source: 'instagram', status: 'new', assignedUid: '', assignedName: '' };
const team = [{ uid: 'u2', name: 'Samrat', whatsappNumber: '', active: true }, { uid: 'u3', name: 'Priya', whatsappNumber: '', active: true }];
const ctx0 = buildLeadContext([], []);
const q = (l: Partial<Lead>, f = DEFAULT_FILTER, ctx = ctx0) => { const L = { ...base, ...l }; return qualifies(L, scoreLead(L, ctx), f); };

test('Instagram lead without mobile is held', () => assert.deepEqual(q({ message: 'price?' }), { ok: false, reason: 'Waiting for mobile number' }));
test('Instagram business buyer with mobile + design + pieces passes', () => assert.equal(q({ phone: '919830012345', buyerType: 'business', designId: 's1', qty: 20 }).ok, true));
test('personal use is held by default', () => assert.match(q({ phone: '919830012345', buyerType: 'personal', designId: 's1' }).reason, /Personal/));
test('low score is held', () => assert.match(q({ phone: '919830012345' }).reason, /Low score/));
test('min pieces', () => assert.match(q({ phone: '919830012345', buyerType: 'business', qty: 3, designId: 's' }, { ...DEFAULT_FILTER, minPcs: 10 }).reason, /Only 3 pcs/));
test('lead from a Sales Person link always passes', () => assert.equal(q({ refUid: 'u2', message: 'hi' }).ok, true));
test('existing customer passes even from Instagram', () => {
  const ctx = buildLeadContext([{ id: 'o', mobile: '9830012345', firmName: 'X', city: '', totalQuantity: 1, totalAmount: 1, salesPersonUid: 'u2' } as never], []);
  assert.equal(q({ phone: '919830012345' }, DEFAULT_FILTER, ctx).ok, true);
});
test('website / WhatsApp leads are not held by the social rules', () => assert.equal(q({ source: 'whatsapp', phone: '' , message: 'hi' }).ok, true));
test('spam held', () => assert.equal(q({ message: 'earn money https://x.y' }).reason, 'Spam'));
test('per-person limit skips a full Sales Person', () => {
  const who = assignWithFilter({ ...base }, ctx0, team, { ...DEFAULT_FILTER, maxOpen: 2 }, new Map([['u3', 2], ['u2', 1]]));
  assert.equal(who?.uid, 'u2');
  assert.equal(assignWithFilter({ ...base }, ctx0, team, { ...DEFAULT_FILTER, maxOpen: 1 }, new Map([['u3', 1], ['u2', 1]])), null);
});
