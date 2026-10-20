/* Run: node --conditions=react-server --import tsx --test tests/wati-send.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendWati, _setWatiFetch } from '../lib/whatsapp/wati';
import { P } from '../lib/whatsapp/payloads';

process.env.WATI_API_ENDPOINT = 'https://live-mt-server.wati.io/12345/';
process.env.WATI_API_TOKEN = 'Bearer abc';

function capture(fail: (url: string) => boolean = () => false) {
  const calls: { url: string; body: any; auth: string }[] = [];
  _setWatiFetch((async (url: string, init: RequestInit) => {
    calls.push({ url, body: init.body ? JSON.parse(String(init.body)) : null, auth: String((init.headers as Record<string, string>).Authorization) });
    const bad = fail(url);
    return new Response(JSON.stringify(bad ? { result: false, info: 'nope' } : { result: true }), { status: 200 });
  }) as typeof fetch);
  return calls;
}

test('text → sendSessionMessage', async () => {
  const c = capture();
  await sendWati('919000011111', P.text('Namaste'));
  assert.equal(c[0].url, 'https://live-mt-server.wati.io/12345/api/v1/sendSessionMessage/919000011111?messageText=Namaste');
  assert.equal(c[0].auth, 'Bearer abc');
});

test('list → sendInteractiveListMessage with sections', async () => {
  const c = capture();
  await sendWati('919000011111', P.list('Kya dekhna hai?', 'Select', [{ id: 'm:new', title: 'Naye designs', description: 'Photo' }]));
  assert.match(c[0].url, /sendInteractiveListMessage\?whatsappNumber=919000011111$/);
  assert.equal(c[0].body.buttonText, 'Select');
  assert.equal(c[0].body.sections[0].rows[0].title, 'Naye designs');
});

test('buttons with photo → image header; refused → photo + numbered text', async () => {
  const c = capture((u) => u.includes('Interactive'));
  await sendWati('919000011111', P.buttons('Design #RZ0138', [{ id: 'order:s2', title: '🛒 Order RZ0138' }], { imageUrl: 'https://x/y.jpg' }));
  assert.equal(c[0].body.header.type, 'Image');
  assert.equal(c[0].body.buttons[0].text, '🛒 Order RZ0138');
  assert.match(c[1].url, /sendSessionFileViaUrl\/919000011111\?url=https/);
  assert.match(decodeURIComponent(c[2].url), /\*1\.\* 🛒 Order RZ0138/);
});
