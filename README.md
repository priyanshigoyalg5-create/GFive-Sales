# GFive Sales Studio

Sample-link ordering for **GFive — Glamour Grace Unlimited** (Kolkata). The website is for staff; customers only ever receive a single design link on WhatsApp.

- **Customer link** — `/s/<id>`: one design (photo gallery with zoom, colour photos, pieces per colour, firm details) and "Place order on WhatsApp". No catalogue, no cart.
- **Admin** — `/admin` (login required; `/` redirects here): Orders dashboard, Samples, Add / Edit sample, PDF sales-order invoices, Ask AI.
- **Super Admin** — everything above + Sales Person Sales (Sales Person-wise orders & sales for salary, CSV export), Team (create logins, set each person's WhatsApp number, disable staff), Settings, permanent delete, and correcting the salesperson on old orders.

## Staff ownership & attribution
- Every sample has a mandatory **design category** (Tyohaar / Rozana / Maharani / Shudh) and an owner (`createdByUid`) set automatically from the logged-in staff member. The catalogue is shared; only the owner or Super Admin can edit/trash a sample.
- Links shared from the admin carry the sharer's id: `/s/<sampleId>?ref=<staffUid>`. An order placed from that link is credited to that person (`salesPersonUid`), separately from who created the sample (`sampleCreatorUid`). Links without a valid `ref` are credited to the sample's creator; very old orders show as "Unassigned" until the Super Admin credits them.
- Placing an order saves it first, then sends it on WhatsApp **with the design photo**: on phones via the share sheet (photo + full message; the customer picks the salesperson's chat, whose name/number is shown), on computers the photo is copied and the salesperson's chat opens with the message (Ctrl+V adds the photo). WhatsApp chat links cannot carry photos, so a fully automatic photo message would need the WhatsApp Business Cloud API. The customer always presses Send in WhatsApp.
- Staff only ever load and can only update (status / trash) their own orders — enforced by `firestore.rules`, not just the UI.

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
5. **Firestore → Rules** — paste `firestore.rules` from this repo, replace `YOUR_SUPERADMIN_EMAIL@gmail.com` with the same email, and Publish. (Use the Rules Playground in the console to double-check: an Admin reading another admin's order must be denied.)
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
- Sales-person credit = the staff member whose shared link (`?ref=`) the customer ordered from; staff only ever see their own numbers.

## AI model photo & video (Samples → "AI model photo / video", or Add/Edit sample → "Create with AI")

Turns the original photo of an unstitched suit into a catalogue photo of a model wearing it, and that photo into a 9:16 model video of 15 s (8 s clip + one Veo extension, ~₹140) or 8 s (~₹70).

- Photo: Google Nano Banana Pro (`gemini-3-pro-image`, ~$0.13 ≈ ₹12 each). Video: Google Veo 3.1 Fast (`veo-3.1-fast-generate-preview`, 8 s 720p ≈ $0.80 ≈ ₹70). Override with `GEMINI_IMAGE_MODEL` / `GEMINI_VIDEO_MODEL`.
- Needs `GEMINI_API_KEY` on Vercel (server only — never `NEXT_PUBLIC_`). Create it in Google AI Studio (https://aistudio.google.com/apikey) on a project with billing enabled, and set a budget alert in Google Cloud Billing.
- Only signed-in, active Sales Persons can call `/api/ai/*`, and only our own Cloudinary photos are sent to Google.
- Results are uploaded to the same Cloudinary account (the unsigned upload preset must allow videos).
- Every AI photo is stored in `sample.aiImages` and is labelled **"AI generated"** (originals say **"Original"**) in the admin and on the customer page; the video is `sample.videoUrl`, labelled "AI generated video". When the cover is AI, the WhatsApp share message says so too.
