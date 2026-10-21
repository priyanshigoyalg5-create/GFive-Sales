# Instagram & Facebook — one-time setup

What it does (code: `lib/social/`, webhook `app/api/meta/webhook`, posting `app/api/social/post`):
- **DMs** on Instagram / Messenger → Lead (source Instagram / Facebook, auto-given to one Sales Person) + reply
  with quick replies (New designs, Rate / order, Call back, WhatsApp). A design number in the DM sends that design's photo,
  details and order link; a mobile number in the DM is saved on the lead.
- **Comments** containing a keyword (price, rate, pp, details…, "?" or "₹") → one private DM with the design and order link,
  a public reply "Aapko DM kiya hai 🙏", and a "Post comment" lead.
- **Post** a design from Samples → Instagram @gfiveindia and/or the Facebook page, with caption. Comments on posts made this
  way are matched to the right design.
- Link-in-bio page: `/enquiry?from=instagram` and `/enquiry?from=facebook` (Leads → Bio links).

## 1. Meta business + app (same "GFive Sales" app as WhatsApp is fine)
1. Business portfolio "GFive Designers Couture" owns the **Gfive** page and **@gfiveindia** (Professional account, linked to the page).
2. App → add products **Messenger** and **Instagram** (Instagram API with Facebook Login) and **Webhooks**.
3. Permissions (App Review → Advanced access, needed for real customers):
   `pages_messaging`, `pages_manage_metadata`, `pages_read_engagement`, `pages_manage_engagement`, `pages_manage_posts`,
   `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`, `instagram_content_publish`, `business_management`.
   Privacy policy URL: `https://gfivesales.vercel.app/privacy`.
4. Business Settings → System users → "gfive-bot" → assign the **page** (full control) and the **app** → Generate token with the
   permissions above (expiry: Never). This is `META_PAGE_TOKEN` (a page access token for that page also works).
5. IDs: Page ID (Page → About / Meta Business Suite → Settings), Instagram account ID
   (`GET /<PAGE_ID>?fields=instagram_business_account` in Graph API Explorer).

## 2. Vercel → Environment Variables (Production + Preview), then Redeploy
| Name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service-account JSON |
| `META_PAGE_ID` | Facebook Page ID |
| `META_IG_USER_ID` | Instagram professional account ID |
| `META_PAGE_TOKEN` | token from step 1.4 |
| `META_APP_SECRET` | App → Settings → Basic → App secret (if not set, `WA_APP_SECRET` is used) |
| `META_VERIFY_TOKEN` | any long word you make up |

## 3. Webhooks
App → Webhooks:
- **Instagram**: callback `https://gfivesales.vercel.app/api/meta/webhook`, verify token = `META_VERIFY_TOKEN`; subscribe `messages`, `comments`.
- **Page**: same URL and token; subscribe `messages`, `feed`. Then subscribe the app to the page (Messenger → Settings → Webhooks → add page).

## 4. Switch on
GFive Sales → Settings → **Instagram & Facebook**: all ticks green → check the comment words → switch ON.
Test: comment "price" on a post made from Samples → you should get a DM; send "hi" to the page / @gfiveindia.

Rules from Meta: DMs can only be answered within 24 h of the customer's message; one private reply per comment, within 7 days.
