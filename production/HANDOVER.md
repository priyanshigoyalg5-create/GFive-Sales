> **Update (v13, Oct 2026):** this app now runs inside the GFive Sales website at `/production`, on the GFive Sales
> Firebase project (collections `jw_*`), with one shared login. Netlify, `firebase.json`, `_headers`, the embedded
> SEED and the Gemini key in Settings are gone. Read `docs/JOBWORK_SETUP.md` first; sections 2, 5 and 6 below describe
> the old Netlify setup.

# GFive Job-Work App: developer handover

Version in this bundle: **v12** (the small "v11" chip in the app header; bump it with every release).
Owner: GFive Designers Couture Pvt Ltd, Kolkata. The owner is non-technical, talks in Hinglish, and deploys by drag-and-drop.

---
## 1. What the business does (read this first)

GFive makes **unstitched salwar suits** (Top + Dupatta + Bottom) through **job work**. Flow:

1. **Fabric inward**: raw fabric arrives from vendors (Surat / Kolkata) by courier or hand, in metres or pieces.
2. **Issue to karigar** (job worker) with a **challan**. One design goes through several stages, each with a different karigar *category*:
   Dyeing, Hand work, Katha, Tailor / Finishing, Computer work, Machine Embroidery, Applique work, Print, Khaka (owner can add more).
3. **Receive** goods back from the karigar (partial receipts are normal).
4. Packing, warehouse, **delivery** to parties.
5. **TNA** (time and action): per order / design, planned vs actual dates for every stage. Today kept in a Google Sheet ("GFIVE TNA SHEET SUMMER").
6. Official books are in **Success ERP** (Shah Software). The app is the shop-floor layer; ERP stays the system of record. Export to ERP is still done via Excel (see backlog).

### Numbering rules that matter
- **Our fabric number** always starts with `F` + digits: `F158`, `F005`, `F1010`. (Vendor codes like `1430SD` are the *item*, not our F-number.)
- **Design number** = letters + digits: `SD11375`, `TY0123`, `RZ0152`, `MH0123`, `CR001`. App strips spaces and hyphens and upper-cases (`SD-11375` becomes `SD11375`).
- **Job card no = S. No** on the paper job card (example `P256`). Same thing, one field: `jobCard`.
- **Meters per piece**: the challan shows the *total* in brackets, e.g. `(5.75)` = **Top 3.15 + Dupatta 2.60**. App auto-splits (dupatta default 2.60, top = total minus dupatta) and **blocks save if top + dup is not equal to total**. Fabric used = qty x (top + dup).
- **Colours** are codes like `P53`, `P54`; one job card can have several colours; each issue line can carry one `colour`.
- **Karigar payment maths** (copied from the ERP "Jobber Receive Memo"): gross = qty x rate; standard deduction 1.5% **rounded**; TDS 1% **floored**, both on gross; net = gross minus both. Check: 25 pcs x 375 = 9375, 141 + 93 deducted, **net 9141**. Percentages are settings (`settings/main`: `std`, `tds`).
- A challan can contain **several items**; each item is one document in `issues` with id `<challan>-<n>`.

---
## 2. Live setup (what is deployed)

| Part | Where |
|---|---|
| App hosting | Netlify (free plan), site `gfiveproduction.netlify.app`, deployed by **drag-and-drop** of the unzipped `app/` folder or its zip |
| Backend | Firebase project **`gfiveproduction`**: Authentication (Phone / OTP) and Firestore (Mumbai, asia-south1). Needs **Blaze plan** for real SMS OTP |
| Photo reading | Gemini REST API with a key typed in the app (More > Settings), stored in `settings/main` |
| Home screen | PWA (manifest + service worker). Play Store (TWA via pwabuilder.com) not done |

Firebase web config is in `app/index.html` (`const CFG`). It is a public identifier, not a secret.
Netlify must serve fresh files: `app/_headers` sets `Cache-Control: no-cache`, and `sw.js` cache name (`gf-vN`) is bumped when shipping.

**What has and has not been verified.** Verified: logic and UI in a headless Chromium against an in-memory fake Firebase (`tools/smoke_test.py`, 24 checks pass), phone OTP login worked in the owner's screenshots (test number and real number). The owner has **not confirmed** that writes (Load starter masters, entries) reach Firestore from a phone. **Never verified end to end by us:** printing on real phones, Excel import/export on a device, Gemini photo reading with a real key, offline sync on a phone, the Firestore security rules against all role combinations (only read through, not rules-unit-tested).

---
## 3. Architecture

- **One file**: `app/index.html` (~145 KB, vanilla JS, no framework, no build step). Keep it deployable by drag-and-drop. If you modularise, keep a build that outputs a plain folder.
- External scripts: Firebase compat SDK 10.12.2 (gstatic, app + auth + firestore), SheetJS xlsx 0.18.5 (jsdelivr), Tesseract.js 5.1.0 (loaded lazily, fallback OCR only).
- **Offline-first**: `enablePersistence({synchronizeTabs:true})`. Writes are queued by Firestore and sync later. `ok(promise)` shows "Saved on phone" when offline and does not await the server. Service worker `sw.js`: network-first for navigations, stale-while-revalidate for the rest, never intercepts Firestore/Auth calls.
- **State**: `D[collection]` arrays filled by `onSnapshot` for every collection in `COLS`. Globals: `ME` (user), `TAB`, `KEEP` (values carried to the next issue line), `QUEUE` (extra items read from a challan photo), `PH` (photo data URL for the form), `CM` (cost memo cache, cleared on every `lists()`).
- **Rendering**: HTML strings. `draw()` rebuilds nav + form (`#F`) + list (`#L`); `lists()` rebuilds only the list area; overlays are `div.ov` appended to `body`. All clicks go through one delegated listener using `data-act` attributes (search `document.addEventListener("click"`).
- **Forms are data-driven**: `FF[tab]` is a list of `[key, label, type, wide]`. Types: `date`, `number`, `unit`, `proc` (category select), `check`, `pick:<vendors|karigars|fabrics|designs|lines|orders>` (opens the searchable picker). Master forms use `MF`. `save()` validates, writes, auto-creates missing masters via `ensure()`.
- **Printing**: `printDoc(title, html)` appends `#pv` and calls `print()`; `@media print` hides everything else. `doPrint(kind,id)` builds each document (issues, receipts, deliveries, challan, jobcard, ledger, bal, stock, tna).
- **Photos** are stored as small JPEG data URLs (about 640 px) inside the Firestore document (`ph`). Watch the 1 MB document limit.
- **Zoom**: the owner wants big bold text; `A-` / `A+` set `document.body.style.zoom`, remembered in localStorage `gf_z`.
- **Look**: cream background, pastel item colours c0..c3 chosen by hashing the karigar/vendor/design name.

### Function map (all inside the one script)
Login/session: `loginView sendOtp verifyOtp saveSess boot logout seedUsers start`. Shell/forms: `tabs shell draw refresh fld formHtml chBanner formView collect chk ensure ok save calcMtr`. Pickers/photo: `items picker pickInto aiRead fillAI onPhoto`. Lists: `item lists mastView mform`. Print: `printDoc doPrint`. Money: `recAmt ledgerRows ledgerTot ledgerView pform`. Helpers: `autoFill dayCard oform`. TNA: `tnaOf tnaView tform`. Costing: `fabLots costBase costOf costView cform`. Stock: `stockFab stockDes stockView`. Alterations: `arform altRet altPend` (types come from `ALL()/AL()/altCat()`). Admin: `moreView uform seed importX exportX`.

---
## 4. Data model (Firestore)

IDs: masters use `sid(key)` = upper-case, non-alphanumerics replaced by `_`. Daily entries use a time-based id except `issues` (`<challan>-<n>`).
Common fields on entries: `at` (ISO time), `by` (user name), `ph` (photo data URL, optional).

| Collection | Doc id | Fields |
|---|---|---|
| `vendors` | sid(name) | name, gstin, address, phone, inactive, auto |
| `karigars` | sid(name) | name, phone, proc (category), inactive, auto |
| `fabrics` | sid(fabNo) | fabNo, name, unit (Mtr/Pcs), rate (Rs per Mtr), width, vendor, ph, inactive, auto |
| `designs` | sid(design) | design, desc, ph, auto |
| `categories` | sid(name) | name, order, inactive |
| `inward` | I+time | date, bill, po, vendor, gstin, item (vendor's code), qty, unit, rate, courier, fabNo (ours), remarks |
| `issues` | challan-n | challan, date, karigar, proc, design, jobCard, colour, qty, rate (job rate Rs/pc), total, topFab, topMtr, dupFab, dupMtr, due, desc, remarks |
| `receipts` | R+time | line (= issue id), date, qty, rate, remarks, **ready** (false = intermediate stage, true = final stage, goes to ready stock) |
| `deliveries` | D+time | date, challan, party, design, qty, remarks |
| `orders` (job cards, TNA **and samples**) | sid(jobCard) | jobCard, design, **kind** (`sample` or empty = production order), **party** (buyer, mainly for samples), brand, orderType, orderDate, qty, deliveryDate, topFab, dupFab, botFab (fabric names or F no), accessories, colours (comma list), scVendor, scPo, scDate, scBy (size cut), cutDate, cutBy, cutQty, packStart, packEnd, whIn, status (manual override), remarks |
| `costs` | sid(design) | design, basis (avg/last), waste %, margin %, sp, extras [{n,a}], top/dup/bot Fab, Mtr, Rate (rate only if edited by hand) |
| `payments` | P+time | karigar, date, amount, mode, remarks |
| `opening` | O+time | type (fab/des), key, qty, unit, rate, date |
| `alters` | A+time | date, challan, design, jobCard (optional), colour, altType, karigar, qty, rate (Rs/pc), due, reason, fromStock (bool), returns [{d,q,r}] (partial returns), remarks, ph |
| `alttypes` | sid(name) | name, proc (karigar category used to filter the karigar picker), order, inactive |
| `settings` | `main` | tds, std, od (overdue days), aiKey, aiModel |
| `users` | `+91XXXXXXXXXX` | name, mobile, role, perms{add,del,masters,export,rates,ledger} |

`auto:true` on a master means it was created automatically from an entry and needs details (shows a "details needed" chip).

### Derived numbers (all computed client-side)
- **Fabric stock** per F no: inward (Mtr) + opening, minus issued (qty x topMtr on topFab, qty x dupMtr on dupFab). Pcs-unit fabrics count qty once.
- **Design stock**: ready = receipts with `ready!==false` + opening(des) minus deliveries. "With karigars" = issued minus received.
- **Weighted average cost**: fabric rate = sum(qty x rate)/sum(qty) over inward lots of that F no (+ opening with rate), master rate as fallback; job work = per category, sum(qty x rate)/sum(qty) over issue lines of that design. Basis can be switched to "latest". Total = fabric x (1 + wastage) + job work + extras. Shown under each design (Stock, Masters, TNA, picker) for users with `rates`.
- **TNA stages** are derived from issue lines matched by `jobCard` (or by design when there is exactly one order for it): Dyeing, Stitching & Finishing (= category Tailor / Finishing), and everything else is "Hand / Embroidery / Print".
- **Sample TNA** is the same machinery as TNA: orders with `kind==='sample'` get their own tab (`tnaView('sample')`), own print and own Excel sheet ('Sample TNA'). Issue lines are linked to a sample by its `jobCard`. In the costing screen job-work lots that belong to a sample are tagged '(sample)'.
- **Alterations** (goods sent back to karigars for repair/re-dye/piping): tab 'Alter'. Types are a master (`alttypes`, Masters > Alteration types, owner can add more); the karigar picker is filtered by the type's category. Returns are partial and stored in `returns[]`. Pending alteration qty with `fromStock!==false` is **subtracted from ready stock** and shown as 'In alteration' on the design stock row; the same pending qty also blocks over-delivery checks. Returned qty x `rate` is added to the karigar **ledger** (gross, so std deduction/TDS apply like normal job work: confirm this with the owner).
- **Overdue** = pending qty and (past `due`, or no `due` and days since issue > settings.od).

---
## 5. Roles and rules

Roles are presets of **permission ticks** (`PRESET`); the ticks, not the role name, decide access: `add`, `del`, `masters`, `export`, `rates`, `ledger`. Super admins get everything.

- 3 **boot super admins** are hard-coded in `firestore.rules` and in `BOOT` in index.html (so first login works before any user doc exists). If numbers change, edit **both**.
- Default users are loaded by `seedUsers()` (3 super, Vijay / Sanjay / Sanker as admin-production, one sub admin).
- `firestore.rules` enforce: create by `add`, delete by `del`, masters by `masters`, costs by `rates`, payments by `ledger` (also read), opening/settings by `masters`, staff may only change `ph` on designs/fabrics.
- **Known gaps**: (1) read access is open to every signed-in user, so the `rates` tick hides rates only in the UI, not at database level (only `payments` reads are protected). (2) `settings/main` holds the Gemini key and is readable by every signed-in user. (3) `add` permission also allows updating `orders`. Fix with a Cloud Function proxy for AI and per-collection read rules if needed.

---
## 6. Build, test, release

```
python3 tools/make_demo.py app/index.html demo/gfive-demo.html     # review build, no Firebase, sample data
python3 tools/smoke_test.py demo/gfive-demo.html                  # needs: pip install playwright; playwright install chromium
python3 tools/build_seed.py DETAILS.xlsx app/seed.json app/index.html [Abdul_Kalam_Job_Work_Register.xlsx]
```
- The **demo** (`tools/demo_mock.html`) contains an in-memory fake `firebase` object and sample data (including a design with 3 fabric purchase rates and 6 job-work lots to demo weighted averages). It can be opened as a file or published as a Claude artifact. Update the mock if you add collections that need sample data.
- `seed.json` is only a copy: the app reads the `const SEED` embedded in `index.html` (a fetched file proved unreliable on Netlify).
- **Release checklist**: edit `app/index.html` > bump the `vN` chip and the `gf-vN` cache name in `sw.js` > rebuild demo and run smoke test > copy `firestore.rules` into Firebase Console (Rules) if changed > zip the *contents* of `app/` (files at zip root) > drop on Netlify Deploys > hard refresh (Ctrl+Shift+R) and check the version chip. Each Netlify deploy uses free-plan credits, so avoid many tiny deploys.

---
## 7. Known issues and backlog (suggested order)

0. Confirm with the owner: sample numbering convention (SMP-01 is only an example), whether alteration amounts really take the same TDS as job work, and whether alteration goods always come from ready stock.
1. **Success ERP export**: only a generic Excel in the owner's register format exists (sheets Issue Register, Receipts, Fabric Inward, ERP Issue, ERP Receipt, TNA, Costing, Stock...). Get the real ERP import template from the owner and match columns exactly.
2. **Editing entries**: only delete + re-enter exists (no edit form for issues, receipts, inward, deliveries; orders have an edit form). Add edit with an audit trail (who/when/old value).
3. **Design pattern validation**: `chk()` accepts `^[A-Z]{1,3}\d+$`. Real designs like `GF26S271`, or seed items with a trailing letter, are rejected in forms. Relax it with the owner.
4. **Bottom fabric** has no metres on the issue (only top/dup), so costing needs bottom metres typed by hand.
5. **AI key security**: move Gemini calls behind a Cloud Function (Blaze plan already needed for OTP) and drop the key from Firestore. Model name changes often; it is a setting (`aiModel`, default `gemini-2.5-flash`). Photo reading is untested with a real key; handwriting quality will vary, so the form always asks the user to check.
6. **Import**: Excel import only reads the old register's Issue Register and Receipts sheets. The old **TNA sheet** (running production) is not imported yet: get the real .xlsx and write an importer for `orders` + `issues`.
7. **Offline OTP**: OTP login needs internet; offline mornings reuse the last session for up to 36 hours.
8. **Play Store**: wrap the PWA as a TWA with pwabuilder.com (needs Play Console, one-time fee, and `assetlinks.json`).
9. Wastage / shortage tracking per karigar, Hindi/Bengali labels, barcode/QR on lots, daily WhatsApp summary.
10. Performance: all collections are loaded in memory; photos inside documents; 1000+ designs. Fine now; consider pagination and Firebase Storage (needs Blaze) if it grows.
11. No automated rules tests. Add Firebase emulator tests for `firestore.rules`.

---
## 8. Owner preferences (keep these)

- Mobile first, **big bold text**, zoom buttons, cream background with pastel blue / pink / purple / green item cards.
- Minimal typing: pickers with search for vendor, karigar, fabric no, design no; manual entry always possible; photo capture on every entry.
- Anything new (vendor, karigar, F no, design no) should be **added automatically** from an entry and completed later.
- Print option wherever a paper document exists (challans, receive memo, job card, ledger, stock, pending list, TNA, costing).
- Replies and explanations to the owner should be in simple Hinglish, short, step by step.

## 9. Private data warning
`app/seed.json` (and the `SEED` inside index.html) contains the owner's real vendor GST numbers, addresses and phone numbers; `firestore.rules` and `BOOT` contain staff phone numbers. Do not publish this bundle publicly.
