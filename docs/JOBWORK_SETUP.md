# GFive Job Work inside GFive Sales (one website, one login)

The Job Work (production) app now lives at **/production** on the GFive Sales website and uses the
**same Firebase project**. After login, **/start** shows two boxes: **Sales** and **Job Work**.
Source: `production/app/index.html` (single file, vanilla JS). `npm run build` copies it into
`public/production/` with the Firebase config (`scripts/build-production.mjs`). Data: `jw_*` collections.

## One-time setup (owner)
1. **Firebase → Upgrade to Blaze** (pay as you go; phone OTP needs it). Billing → Budgets: set a ₹500 alert.
2. **Firebase → Authentication → Sign-in method → Phone → Enable.** (Email/Password stays on.)
3. **Authentication → Settings → Authorized domains**: `gfivesales.vercel.app` (and any custom domain) must be listed.
4. **Vercel → Settings → Environment Variables** (Production), then Redeploy:
   - `NEXT_PUBLIC_JW_BOOT_PHONES` = `+91XXXXXXXXXX,+91XXXXXXXXXX,+91XXXXXXXXXX` (Job Work super admins)
   - `JW_DEFAULT_USERS` (optional) = `[["Vijay","9xxxxxxxxx","admin"],["Sanjay","9xxxxxxxxx","admin"]]`
     — loaded the first time a super admin opens Job Work
   - `GEMINI_API_KEY` (already set for AI photos) — now also reads challan / bill photos; optional `JW_AI_MODEL`
5. **Firestore → Rules**: publish the full `firestore.rules` (fill `superEmails()` and `jwBootPhones()`).
6. Open the site → login (Email or Mobile OTP) → **Job Work** → More → **Load starter masters** → choose `seed.json`
   (from the developer handover zip; it is not stored on the website or in GitHub).

## Logins
- Super admins: log in with e-mail as before, then on /start add the mobile once (OTP). After that, e-mail or mobile
  both open Sales and Job Work.
- Production staff (Vijay, Sanjay…): **Mobile OTP** on the login page. They only see Job Work (add them in Job Work → More → Users).

## What changed from the Netlify version (v12 → v13)
- Data in the GFive Sales Firebase project, collections `jw_*`; reads only for registered users (was: anyone who could get an OTP).
- Gemini key is no longer in the database or the browser — photos are read through `/api/jw/ai-read`.
- Vendor GST / address / phone list (starter masters) and staff mobiles are no longer inside the page or the code.
- One issue challan = many colours of one design (rows), "Colours from job card", AI challan photo fills all rows
  (other designs on the same challan come next).
- SAMPLE issue tick (auto when a sample no is chosen); sample lines tagged SAMPLE in issue / receive.
- Brand from design no (SD→SUDH, RZ→ROZANA, GF→GFIVE, MH→MAHARANI, TY→TYOHAAR), still changeable.
- Colour dropdown P1–P100, D1–D50, M1–M50 (multi-select on orders / samples), order type, party, brand dropdowns.
- Fabric picker sorted by fabric name; order fabrics are chosen from the fabric list and filled from the last order of the design.
- Karigar / vendor / party names read from photos are matched to the nearest master name.
- Design numbers like GF26S271 are accepted.
- Login is shared with GFive Sales (no separate morning OTP; Logout signs out of both).

## Test
```
python3 production/tools/make_demo.py production/app/index.html /tmp/gfive-demo.html
python3 production/tools/smoke_test.py /tmp/gfive-demo.html     # 41 checks, fake Firebase
```
