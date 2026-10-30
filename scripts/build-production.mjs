/**
 * Builds the GFive Job-Work (production) app into public/production/ so it is served by the
 * same website and the same Firebase project as GFive Sales.
 *  - Firebase web config comes from the NEXT_PUBLIC_FIREBASE_* env (public identifiers)
 *  - <base href="/production/"> so relative files load from /production/
 *  - service worker cache name changes with every deploy
 * Source: production/app/ (edit there, never in public/production/).
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const src = path.join(root, 'production', 'app');
const out = path.join(root, 'public', 'production');

// .env.local for local builds (Vercel passes env directly)
const envFile = path.join(root, '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const e = process.env;
const cfg = {
  apiKey: e.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: e.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: e.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: e.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: e.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: e.NEXT_PUBLIC_FIREBASE_APP_ID,
};
for (const k of Object.keys(cfg)) if (!cfg[k]) delete cfg[k];
if (!cfg.apiKey || !cfg.projectId) console.warn('[build-production] Firebase env missing — Job Work page will not connect.');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
if (!html.includes('/*CFG*/{}/*CFG*/')) throw new Error('CFG marker missing in production/app/index.html');
// super admin mobiles + default users: from env so phone numbers are not in the code
const boot = (e.NEXT_PUBLIC_JW_BOOT_PHONES || '').split(',').map((x) => x.trim()).filter((x) => /^\+\d{10,14}$/.test(x));
let users = [];
try {
  users = JSON.parse(e.JW_DEFAULT_USERS || '[]');
} catch {
  console.warn('[build-production] JW_DEFAULT_USERS is not valid JSON — ignored');
}
if (!boot.length) console.warn('[build-production] NEXT_PUBLIC_JW_BOOT_PHONES is empty — no Job Work super admin can log in.');
html = html.replace('/*BOOT*/[]/*BOOT*/', JSON.stringify(boot)).replace('/*USERS*/[]/*USERS*/', JSON.stringify(users));
html = html.replace('/*CFG*/{}/*CFG*/', JSON.stringify(cfg)).replace('<head>', '<head>\n<base href="/production/">');
fs.writeFileSync(path.join(out, 'index.html'), html);

const ver = (e.VERCEL_GIT_COMMIT_SHA || Date.now().toString(36)).slice(0, 8);
const sw = fs.readFileSync(path.join(src, 'sw.js'), 'utf8').replace(/const V="gf-v\d+"/, `const V="gf-${ver}"`);
if (!sw.includes(`gf-${ver}`)) throw new Error('cache name not found in sw.js');
fs.writeFileSync(path.join(out, 'sw.js'), sw);

for (const f of ['manifest.json', 'icon-180.png', 'icon-192.png', 'icon-512.png']) fs.copyFileSync(path.join(src, f), path.join(out, f));
console.log(`[build-production] public/production ready (cache gf-${ver})`);
