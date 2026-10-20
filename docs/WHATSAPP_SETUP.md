# GFive WhatsApp bot — one-time setup

The bot runs on Vercel (`/api/whatsapp/webhook`) — no separate server or deploy.
Code: `lib/whatsapp/` (adapted from the SLG RWA bot). Tests: `npx tsx --test tests/whatsapp-bot.test.ts`.

## 1. Meta (Priyanshi's developer login)
1. business.facebook.com → **Create a business portfolio** "GFive Designers Couture".
   Add the **Gfive** Facebook page and **@gfiveindia** Instagram (Professional account, linked to the page).
2. Security Center → **Business verification** (GST certificate / company documents).
3. developers.facebook.com → **My Apps → Create App** → type *Business* → name "GFive Sales" → portfolio "GFive Designers Couture".
4. Add product **WhatsApp** → API Setup → add / verify the business phone number.
5. Business Settings → **System users** → add "gfive-bot" (Admin) → *Add assets*: the app (full control) and the WhatsApp account → **Generate token** with `whatsapp_business_messaging`, `whatsapp_business_management` (expiry: Never).
6. App → Settings → Basic → copy **App secret**. Set **Privacy policy URL** = `https://gfivesales.vercel.app/privacy`.

## 2. Firebase
Firebase Console → ⚙ Project settings → **Service accounts** → *Generate new private key* → a .json file downloads.
Never share it on chat / WhatsApp.

## 3. Vercel → Settings → Environment Variables (Production + Preview), then Redeploy
| Name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | whole content of the .json file |
| `WA_TOKEN` | system-user token (step 1.5) |
| `WA_PHONE_NUMBER_ID` | WhatsApp → API Setup → *Phone number ID* |
| `WA_APP_SECRET` | App secret (step 1.6) |
| `WA_VERIFY_TOKEN` | any long word you make up, e.g. `gfive-bot-2026-xyz` |
| `NEXT_PUBLIC_SITE_URL` | `https://gfivesales.vercel.app` (or your domain) |

## 4. Connect the webhook
Meta app → WhatsApp → **Configuration** → Webhook:
- Callback URL: `https://gfivesales.vercel.app/api/whatsapp/webhook` (also shown in GFive Sales → Settings → WhatsApp bot)
- Verify token: the same `WA_VERIFY_TOKEN`
- **Verify and save**, then subscribe to the **messages** field.

## 5. Test, then go live
GFive Sales → Settings → WhatsApp bot: all five ticks green → add your own numbers in **Test mode** → switch **ON**.
Send "hi" to the business number. When everything works, clear the test numbers (= all customers).

## Cost (Meta, India)
Replies to a customer's message within 24 h are free (service conversations). Messages the business starts later
(order updates, new-design broadcasts) need approved templates and are charged per message — see Meta's pricing page.

---

# Option B — number stays on WATI

Use this when the business number is connected to WATI (keeps the WATI inbox and team chat).
Our bot then receives WATI's "Message Received" webhook and replies through the WATI API.
Code: `lib/whatsapp/wati.ts`, webhook `app/api/whatsapp/wati`.

1. **WATI plan** must include API + webhooks.
2. WATI dashboard → **API Docs** (or Connector → API): copy the **API Endpoint**
   (looks like `https://live-mt-server.wati.io/123456`) and create / copy the **Access Token**.
3. Vercel → Environment Variables (Production + Preview), then Redeploy:
   | Name | Value |
   |---|---|
   | `FIREBASE_SERVICE_ACCOUNT` | Firebase service-account JSON (see Option A §2) |
   | `WATI_API_ENDPOINT` | API endpoint from step 2 |
   | `WATI_API_TOKEN` | access token from step 2 |
   | `WATI_WEBHOOK_KEY` | any long secret word you make up |
   | `NEXT_PUBLIC_SITE_URL` | `https://gfivesales.vercel.app` |
4. WATI → **Webhooks → Add webhook** → event **Message Received** →
   URL `https://gfivesales.vercel.app/api/whatsapp/wati?key=<your WATI_WEBHOOK_KEY>`.
5. In WATI, **switch off WATI's own auto-reply / default chatbot** for these chats (or for keywords like "hi"),
   otherwise customers get two replies.
6. GFive Sales → Settings → WhatsApp bot → choose **WATI** → test numbers → ON → send "hi".

Notes
- If WATI refuses a button/list message, the bot sends the same options as numbered text ("1. Naye designs …");
  customers can reply with the number. Button replies that come back with only their title are matched to the right action.
- Team members can still reply manually from the WATI inbox; the bot keeps every chat as a Lead in GFive Sales.
