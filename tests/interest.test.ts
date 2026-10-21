/* Run: npx tsx --test tests/interest.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) } as Storage;

test('counts different designs and days', async () => {
  const { noteVisit, readInterest } = await import('../lib/interest');
  assert.equal(readInterest(), null);
  const d1 = Date.UTC(2026, 9, 20, 10), d2 = Date.UTC(2026, 9, 21, 10);
  noteVisit('s1', d1); noteVisit('s1', d1); noteVisit('s2', d1); noteVisit(undefined, d2); noteVisit('s3', d2);
  assert.deepEqual(readInterest(), { designs: 3, visits: 2, firstSeen: d1 });
});
