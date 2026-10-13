# GFive Sales Studio

Sample-link ordering for **GFive — Glamour Grace Unlimited** (Kolkata). The website is for staff; customers only ever receive a single design link on WhatsApp.

- **Customer link** — `/s/<id>`: one design (photo gallery with zoom, colour photos, pieces per colour, firm details) and "Place order on WhatsApp". No catalogue, no cart.
- **Admin** — `/admin` (login required; `/` redirects here): Orders dashboard, Samples, Add / Edit sample, PDF sales-order invoices, Ask AI.
- **Super Admin** — everything above + Team (create Admin / Super Admin logins, disable staff), Settings (company details, WhatsApp number), permanent delete.

Old links (`/s/<id>`, `/admin/add?edit=<id>`) keep working, and order numbers continue from the same counter (`GFive#…`).

## Stack
Next.js 16 (App Router) · Tailwind CSS 4 · Firebase Auth + Firestore · Cloudinary (photos) · jsPDF (invoices)

## Environment variables (Vercel → Project → Settings → Environment Variables)

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=jhddliu0          # optional, this is the default
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=textile_preset # optional, this is the default
NEXT_PUBLIC_SUPERADMIN_EMAILS=owner@example.com     # comma separated, NEW
```

## One-time setup for login

1. **Firebase Console → Authentication → Sign-in method →** enable **Email/Password**.
2. **Authentication → Users → Add user** — create the owner's login (email + password).
3. Put that email in `NEXT_PUBLIC_SUPERADMIN_EMAILS` on Vercel and redeploy.
4. **Authentication → Settings → Authorized domains** — make sure `gfivesales.vercel.app` (and any preview domain you use) is listed.
5. **Firestore → Rules** — paste `firestore.rules` from this repo, replace `YOUR_SUPERADMIN_EMAIL@gmail.com` with the same email, and Publish.
6. Sign in at `/admin/login`. The first sign-in creates your Super Admin profile. Add other staff from **Team**.

## Develop

```bash
npm install
npm run dev
```

PDF invoices embed a subset of the Carlito font (SIL Open Font License) from `public/fonts` so that ₹ prints correctly.

## Gfive Insights — AI sales assistant for staff (Admin → Ask AI)

Staff can ask things like "Aaj kitne orders aaye?", "Is mahine sabse zyada kaunsa design bika?" or "Kis sales person ne sabse zyada sale kiya aur kyun?".

- All numbers (orders, pieces, amounts, top designs, sales-person totals, pending orders) are calculated exactly in `lib/analytics.ts`; the AI only explains them, so it can't get the maths wrong.
- The summary cards at the top work even without an API key.
- `/api/admin-chat` checks the signed-in user is active staff (via their Firebase token + Firestore rules) before calling the AI.
- Needs `ANTHROPIC_API_KEY` on Vercel (create at https://console.anthropic.com, set a monthly spend limit). Optional `CHAT_ADMIN_MODEL` (default `claude-sonnet-5-5`). Without the key the page still shows the summary cards.
- Sales-person credit = the person whose name is on the design sample (whose shared link brought the order).
