# GFive Sales Studio

Boutique catalogue + WhatsApp ordering for **GFive — Glamour Grace Unlimited** (Kolkata).

- **Shop (public)** — `/` collection, `/s/<id>` design page (photo gallery, zoom, colour-wise quantities), `/cart` (multiple designs, firm details, order on WhatsApp).
- **Admin** — `/admin` (login required): Orders dashboard, Samples, Add / Edit sample, PDF sales-order invoices.
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
