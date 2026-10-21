# GST number in the lead filter

## What works without any setup (free)
* Customers can give their shop's **GST number** on the enquiry page (bio link), in Instagram /
  Facebook DMs (the bot asks shops that are still on hold), and the team can add it on any lead.
* Every GST number is checked **offline**: 15-character format, state code and the check digit.
  Typing mistakes and made-up numbers are caught at once.
* State, PAN and type of business (proprietor, firm, company…) are read from the GST number —
  **no need to ask customers for their PAN card**.
* Lead filter (Leads → Lead filter → 🧾 GST number):
  * *Valid GST + mobile → straight to a Sales Person* (on by default)
  * *Shops must give a GST number* (off by default)

## Online check (optional, paid per check)
Shows the **registered firm name**, **Active / Cancelled** status and city from the GST records,
and compares the name with what the customer typed:
`GST verified · name matches` / `GST active · name different` / `GST cancelled` / `GST not found`.

1. Make an account at **Cashfree Payments → Secure ID** (merchant.cashfree.com), finish KYC and
   activate **GSTIN Verification**. Add credits.
2. Developers → API keys → copy **Client ID** and **Client Secret** (production).
3. Vercel → Project → Settings → Environment Variables (Production), add:
   * `CASHFREE_CLIENT_ID`
   * `CASHFREE_CLIENT_SECRET`
   * (testing only) `CASHFREE_ENV` = `sandbox`
   Never put these in chat or in a `NEXT_PUBLIC_` variable. `FIREBASE_SERVICE_ACCOUNT` must
   also be set (same as for the WhatsApp bot).
4. If Cashfree asks to whitelist a server IP: Vercel's IPs change, so pick the option without
   IP whitelisting.
5. Redeploy, then Leads → Lead filter → tick **Check GST online**.

Each GST number is checked online at most once every 30 days (cached in `gstChecks`), only
for leads not yet given to a Sales Person, or when someone taps **Check online**.

## Mobile number
GST records don't contain a mobile number, so mobile can't be matched with GST. A WhatsApp
chat proves the number (the message came from it); for Instagram / Facebook the Sales Person's
first call confirms it.
