# GFive Job-Work app (offline PWA, OTP login)

Phone me install hone wala app. Bina internet ke entry hoti hai, net aate hi apne aap sync hoti hai.

## Ek baar ka setup (naya Firebase project, slg-rwa / Numero Vastu me nahi)
1. https://console.firebase.google.com > Add project > naam `gfiveproduction`.
2. Build > Authentication > Get started > Sign-in method > **Phone** ko Enable karo.
   (Phone OTP ke liye Firebase ka **Blaze (pay as you go)** plan lagta hai. Chhote use me kharcha bahut kam hota hai. Billing > Budgets me Rs 500 ka alert laga dena.)
3. Authentication > Settings > Authorized domains me `<project>.web.app` apne aap hota hai. Custom domain ho to wo bhi jodo.
4. Build > Firestore Database > Create database (production mode, region asia-south1 Mumbai).
5. Firestore > Rules me `firestore.rules` ka content paste karke Publish karo.
6. Project settings > Your apps > Web (</>) > register karo. Jo `firebaseConfig` mile use `index.html` me `const CFG={...}` me paste karo. Apna GSTIN `OWN_GSTIN` me daalo.
7. Hosting: `npm i -g firebase-tools`, is folder me `firebase login`, `firebase init hosting` (public dir = `.`, existing files overwrite = No), `firebase deploy`.
8. Link ko phone ke Chrome me ek baar **internet ke saath** kholo > Install app.
9. Pehla login: koi bhi super admin (numbers in NEXT_PUBLIC_JW_BOOT_PHONES on Vercel) OTP se login kare. Default users apne aap ban jaate hain.
10. More > "Load starter masters": 68 vendor (GST, address, mobile), 99 karigar (mobile, process), 138 F-number fabric (rate ke saath) aur design numbers bhar jaate hain.

## Roles aur rights (More > Users and rights me tick se badal sakte ho)
- **Super admin:** Rajesh Goyal, Aayushvardhan Goyal, Manish S Goyal. Sab kuch.
- **Admin (production):** Vijay, Sanjay, Sanker. Entry (inward, issue, receive).
- **Sub admin:** Entry + masters + Excel + rates. Delete ka tick super admin lagayega.
- Naya user: More > Add user. Staff = sirf entry.
Rights: entry, delete, masters (add/edit/delete), Excel download, rates dekhna.

## Vendor, karigar, fabric add / delete
Masters tab: "+ Add". Kisi par tap karke edit karo. Jis ke saath ab kaam nahi hota uspar tick "Not working now" (list se hat jaata hai, purani entry bani rehti hai) ya "Delete permanently" (masters right chahiye).

## Login
Roz subah mobile + OTP ek baar. Subah 4 baje tak bina login ke chalega, offline bhi. Offline subah me pichhla login 36 ghante tak chal jaata hai. Naya OTP ke liye internet chahiye.

## Play Store
Hosting live hone ke baad pwabuilder.com par link daalo > Android package (TWA) > Play Console (ek baar $25) me upload karo.

## Stock aur Delivery
- **Stock tab:** Design stock (issued, received, karigar ke paas, delivered, ready stock), Fabric stock F-number wise (inward minus issued meters), aur process-wise (head-wise) pending.
- **Delivery tab:** party ko maal bhejne ki entry (design no + qty). Ready stock se zyada ho to app poochta hai.
- **Receive me "Ready for delivery" tick:** jab maal us design ka last stage poora karke aaye tab tick rakho (default tick hai). Beech ke stage (jaise dyeing ke baad abhi hand work baaki) me tick hata do. Ready stock sirf tick wali receipts se banta hai.
- Excel export me Delivery, Stock Design aur Stock Fabric sheets bhi aati hain.

## Karigar categories
Dyeing, Hand work, Katha, Tailor / Finishing, Computer work, Machine Embroidery, Applique work, Print, Khaka.
Masters > Categories me naya category add / hide / delete kar sakte ho (masters right chahiye).
Issue me pehle Category chuno, phir Karigar par tap karo: sirf us category ke karigar dikhte hain ("Tap here to show all" se sab).
Masters > Karigars me Category se filter hota hai. "Load starter masters" dobara dabane par categories aur karigar ki category bhar jaati hai.

## Design aur Fabric ki photo
Masters > Designs ya Fabrics me kisi par tap karo > "Add photo" (camera ya gallery). Photo list me, picker me aur Stock me chhoti dikhti hai.
Entry rights wale staff bhi sirf photo jod sakte hain (naam ya rate nahi badal sakte). Iske liye `firestore.rules` dobara Publish karo.

## Naye features (opening stock, ledger, print, overdue)
- **Opening stock:** More > Opening stock > "+ Add". Purana fabric (F no, meter/pcs) aur ready design stock ek baar daalo. Stock tab me juda hota hai.
- **Karigar ledger (tick se):** Users and rights me kisi user par "Karigar ledger and payments" tick karo, tab hi Ledger tab dikhega. Karigar chuno > received amount, Std deduction, TDS, net, paid, balance. "+ Add payment" se payment likho. Super admin ko hamesha milta hai.
- **Std deduction aur TDS %:** More > Settings (default 1.5% aur 1%, aapke receive memo jaisa: 9375 -> net 9141).
- **Print:** Issue, Receive aur Delivery ki har entry par "Print" button. Balance me "Print pending list", Stock me "Print this list", Ledger me "Print statement". Print screen me "Save as PDF" chuno.
- **Overdue:** Issue me "Return by" date. Na di ho to 15 din (Settings me badal sakte ho) baad lal "OVERDUE". Balance me "Show only overdue".
- **Day summary:** Balance me kisi bhi din ka inward, issue, receive, delivery.
- **Rate auto-fill:** Karigar aur design chunte hi pichhli entry se rate, fabric aur meter bhar jaate hain.
- **Excel:** ERP Issue, ERP Receipt, Opening Stock aur Payments (ledger tick wale ko) sheets. Success ERP ka asli import template milne par columns usi ke hisaab se badal denge.
- `firestore.rules` dobara Publish karo (payments, opening, settings ke naye rules).

## TNA (time and action)
- **TNA tab:** har order / job card ke liye order date, delivery date, aur Dyeing, Hand / Embroidery / Print, Stitching & Finishing ka karigar, challan, issue date, receive date, din, aur Current Status. Ye karigar ki issue aur receive entries se apne aap banta hai (Issue me Job card no se judta hai).
- **+ New order / job card:** design, job card, brand (SUDH / GFIVE / ROZANA), order date, qty, delivery date, top / dupatta / bottom fabric.
- Order par tap karke packing start, packing end, warehouse in date aur status badal sakte ho.
- Delivery date nikal jaye aur maal delivered na ho to "DELAYED". "Show only delayed" aur "Print TNA".
- Issue me Job card no par tap karke order chuno: design aur pichhli entry ka rate bhar jaata hai.
- Excel export me "TNA" sheet (aapki TNA sheet ke columns jaisi).
- `firestore.rules` dobara Publish karo (orders ke rules).

## Costing (BOM) aur weighted average cost
- **Cost tab** (rates tick wale ko): har design ka per piece cost = fabric + job work + other cost. Design par tap karo to poora hisaab khulta hai, "Print costing" aur "Save costing" bhi.
- **Fabric weighted average:** ek hi F-number alag vendor se alag rate par aaye (F005 @120, @125, @130) to rate = sabhi inward ka quantity ke hisaab se average. Opening stock me rate daalo to wo bhi judta hai.
- **Job work weighted average:** ek hi design alag karigar se alag rate par bane (sample 1 se 4 pc, phir 50 pc @800, phir 100 pc @500) to rate = sabhi lots ka pcs ke hisaab se average. Har lot, latest rate aur sabse sasta karigar dikhta hai.
- **Costing basis:** "Weighted average" ya "Latest rate only" chun sakte ho.
- Har design ke neeche **Cost Rs X/pc (weighted avg)** dikhta hai: Stock, Masters > Designs, TNA aur design chunne wali list me.
- Other cost: packing, courier, overhead, lace jaisa kuch bhi jod sakte ho. Profit % se suggested selling price aur lot cost.
- Excel export me "Costing" sheet.
- `firestore.rules` dobara Publish karo (costs ke rules).

## Photo se padhna (AI) aur ek challan me kai items
- **AI key (zaroori, tabhi camera se bill / challan / job card padhega):** aistudio.google.com/apikey par free Gemini key banao (Google account se). More > Settings > "Gemini API key" me paste karke Save karo. Key ko apni website tak limit kar do (key ke Application restrictions me "Websites" chuno aur apna link daalo). Model naam badalna ho to wahi Settings me "AI model name".
- Bina key ke purana text reader chalta hai, jo haath ki likhai nahi padh pata.
- **Padhne wali photo:** Inward (vendor bill), Issue (challan), Delivery aur New order / Job card (paper job card: S. No, design, qty, fabric, accessories, colours).
- **Ek challan me kai items:** Issue me "Save and add another item to this challan" dabao. Challan, date, karigar wahi rehte hain. Photo me kai lines hon to baaki lines line-line se bhar jaati hain. "Print whole challan" se saare items ek challan me print hote hain.

## Sample TNA aur Alteration (v12)
- **Sample TNA tab:** bilkul TNA jaisa, sirf samples ke liye. "+ New sample" se sample banta hai (sample no, design, party, qty, colours). Issue me wahi sample no (Job card no) daalo to stage apne aap judte hain. Sample alag print aur Excel sheet "Sample TNA" me aata hai. Production TNA me sample nahi dikhta.
- **Alter tab:** jo maal karigar ko alteration ke liye diya jaata hai: design no, colour, kaunsa kaam (Dyeing re-dye / Hand work repair / Piping repair / Stitching repair / Other), karigar (kaam ke hisaab se list chhoti ho jaati hai), qty, rate, return by, kya theek karna hai. Maal wapas aane par "Receive back" (partial bhi). Pending alter Stock me "In alteration" dikhta hai aur ready stock se ghat jaata hai. Alter ka paisa karigar ledger me judta hai. Print alteration challan aur Excel sheet "Alterations".
- **Naye alteration kaam** Masters > Alteration types me add kar sakte ho.
- `firestore.rules` dobara Publish karo (alters, alttypes ke rules).
