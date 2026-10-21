'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Expand, Palette, MessageCircle, Loader2, CheckCircle2, Share2, Phone } from 'lucide-react';
import type { OrderLine, Sample } from '@/lib/types';
import { cldThumb, digitsOnly, inr } from '@/lib/format';
import { sampleColors, samplePhotos, allSamplePhotos, sampleLink, isAiPhoto } from '@/lib/samples';
import { buildOrderWhatsAppText, type CustomerDetails } from '@/lib/orders';
import { loadCustomer, saveCustomer } from '@/lib/customer';
import { createLead, createOrder, getPublicStaff, getSample, nextOrderNumber, usePublicSettings } from '@/lib/public-db';
import Lightbox from '@/components/Lightbox';
import QtyStepper from '@/components/QtyStepper';
import { canShareFiles, fetchImageFile, sharePhotosWithText } from '@/lib/wa-share';
import { categoryName, normCategory } from '@/lib/categories';

const EMPTY: CustomerDetails = { firmName: '', mobile: '', city: '', gstNo: '', agentName: '', remarks: '' };

export default function SampleOrderPage() {
  const { id } = useParams<{ id: string }>();
  const settings = usePublicSettings();

  const [sample, setSample] = useState<Sample | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');
  const [active, setActive] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [c, setC] = useState<CustomerDetails>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerDetails | 'qty', string>>>({});
  const [busy, setBusy] = useState(false);
  const [failMsg, setFailMsg] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ orderNo: string; text: string; pcs: number; amount: number; to: string } | null>(null);
  // salesperson credited for this order = whoever shared the link (?ref=), else the sample's creator
  const [seller, setSeller] = useState<{ uid: string; name: string; whatsappNumber: string } | null>(null);
  // design photo, fetched in advance so it can be attached to the WhatsApp message instantly
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [phoneShare] = useState(() => canShareFiles());
  const [cb, setCb] = useState<'idle' | 'busy' | 'done'>('idle');
  const [cbErr, setCbErr] = useState<string | null>(null);
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'shared'>('idle');
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // sample and the sharing salesperson are fetched at the same time
        const ref = new URLSearchParams(window.location.search).get('ref');
        const [found, viaLink] = await Promise.all([getSample(id), getPublicStaff(ref)]);
        if (!alive) return;
        if (found && !found.isTrashed) {
          const s = found;
          const viaCreator = viaLink ? null : await getPublicStaff(s.createdByUid);
          const p = viaLink || viaCreator;
          if (!alive) return;
          setSeller(p ? { uid: p.uid, name: p.name, whatsappNumber: p.whatsappNumber || '' } : { uid: '', name: s.salesPerson || '', whatsappNumber: '' });
          setSample(s);
          const init: Record<string, number> = {};
          sampleColors(s).forEach((col) => (init[col.name] = 0));
          setQty(init);
          setState('ok');
        } else setState('missing');
      } catch {
        if (alive) setState('missing');
      }
    })();
    // firm details remembered on this phone from the last order
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setC(loadCustomer({ ...EMPTY, remarks: '' }));
    return () => {
      alive = false;
    };
  }, [id]);

  const photos = useMemo(() => (sample ? samplePhotos(sample) : []), [sample]);
  useEffect(() => {
    if (!sample || !photos[0]) return;
    let alive = true;
    fetchImageFile(photos[0], `Design_${sample.designNumber}.jpg`).then((f) => alive && setPhotoFile(f));
    return () => {
      alive = false;
    };
  }, [sample, photos]);
  const viewerPhotos = useMemo(() => (sample ? allSamplePhotos(sample) : []), [sample]);
  const colors = useMemo(() => (sample ? sampleColors(sample) : []), [sample]);

  const totalPcs = Object.values(qty).reduce((a, b) => a + (b || 0), 0);
  const price = Number(sample?.price || 0);
  const totalAmt = totalPcs * price;

  const set = (k: keyof CustomerDetails, v: string) => {
    setC((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  // Orders open the WhatsApp chat of the salesperson behind the link (company number if they have none)
  const targetNumber = seller?.whatsappNumber || settings.whatsappNumber;
  const waLink = (text: string, to = targetNumber) => `https://api.whatsapp.com/send?phone=${to}&text=${encodeURIComponent(text)}`;

  /**
   * Opens the WhatsApp chat of the salesperson behind the link, with the order message
   * prefilled. The message ends with the design link, which WhatsApp shows as the design
   * PHOTO inside the same message (link preview).
   */
  const openSellerChat = (text: string, to: string) => window.location.assign(waLink(text, to));

  /** Optional: send the photo as a real attachment (phone share sheet — customer picks the chat). */
  const sendPhotoAttachment = async (text: string) => {
    setSendState('sending');
    const file = photoFile || (photos[0] ? await fetchImageFile(photos[0], `Design_${sample?.designNumber}.jpg`) : null);
    const r = file ? await sharePhotosWithText([file], text) : 'failed';
    setSendState(r === 'shared' ? 'shared' : 'idle');
  };

  const placeOrder = async () => {
    if (!sample) return;
    const e: typeof errors = {};
    if (totalPcs <= 0) e.qty = 'Please enter pieces for at least one colour';
    if (!c.firmName.trim()) e.firmName = 'Firm name is required';
    if (digitsOnly(c.mobile).length < 10) e.mobile = 'Enter a valid 10-digit mobile number';
    if (!c.city.trim()) e.city = 'City is required';
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById(e.qty ? 'colours' : 'details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    setBusy(true);
    setFailMsg(null);
    try {
      const items: Record<string, number> = {};
      const colorPhotos: Record<string, string> = {};
      colors.forEach((col) => {
        const q = qty[col.name] || 0;
        if (q > 0) {
          items[col.name] = q;
          if (col.photoUrl) colorPhotos[col.name] = col.photoUrl;
        }
      });
      const line: OrderLine = {
        sampleId: sample.id,
        designNumber: sample.designNumber,
        price,
        fabric: sample.fabric || '',
        work: sample.work || '',
        salesPerson: seller?.name || '',
        category: normCategory(sample.category),
        image: photos[0] || '',
        items,
        colorPhotos,
        totalQuantity: totalPcs,
        totalAmount: totalAmt,
      };
      const clean: CustomerDetails = {
        firmName: c.firmName.trim(),
        mobile: c.mobile.trim(),
        city: c.city.trim(),
        gstNo: c.gstNo.trim().toUpperCase(),
        agentName: c.agentName.trim(),
        remarks: c.remarks.trim(),
      };
      const orderNo = await nextOrderNumber();
      await createOrder({
        orderId: orderNo,
        lines: [line],
        sampleId: sample.id,
        designNumber: sample.designNumber,
        price,
        items,
        colorPhotos,
        salesPerson: seller?.name || 'N/A',
        salesPersonUid: seller?.uid || '',
        salesPersonName: seller?.name || '',
        sampleCreatorUid: sample.createdByUid || '',
        sampleCreatorName: sample.createdByName || sample.salesPerson || '',
        category: normCategory(sample.category),
        refUsed: new URLSearchParams(window.location.search).get('ref') || '',
        ...clean,
        totalQuantity: totalPcs,
        totalAmount: totalAmt,
        unit: 'pcs',
        status: 'Pending',
        isTrashed: false,
      });
      saveCustomer({ ...clean, remarks: '' });
      // link with the salesperson's ref → WhatsApp shows the design photo preview in their chat
      const text = buildOrderWhatsAppText(orderNo, [line], clean, sampleLink(sample.id, seller?.uid));
      setPlaced({ orderNo, text, pcs: totalPcs, amount: totalAmt, to: targetNumber });
      window.scrollTo({ top: 0 });
      // Order is saved; now send it on WhatsApp WITH the design photo.
      openSellerChat(text, targetNumber);
    } catch (err) {
      console.error(err);
      setFailMsg('Could not place the order. Please check your internet and try again.');
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------------------------ states
  if (state === 'loading') {
    return (
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 md:grid-cols-2">
        <div className="aspect-[4/5] animate-pulse rounded-3xl bg-sand" />
        <div className="space-y-4">
          <div className="h-10 w-1/2 animate-pulse rounded bg-sand" />
          <div className="h-48 animate-pulse rounded-2xl bg-sand" />
        </div>
      </div>
    );
  }

  if (state === 'missing' || !sample) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="font-display text-3xl text-ink">This design is no longer available</p>
        <p className="mt-2 text-muted">It may have been sold out or removed. Please contact us on WhatsApp for similar designs.</p>
        <a href={`https://wa.me/${settings.whatsappNumber}`} className="btn btn-whatsapp mt-6">
          <MessageCircle size={17} /> Message GFive
        </a>
      </div>
    );
  }

  if (placed) {
    return (
      <div className="mx-auto max-w-md px-4 py-14 text-center animate-fade-up">
        <CheckCircle2 size={56} className="mx-auto text-leaf-600" strokeWidth={1.5} />
        <p className="eyebrow mt-5">Order saved · one more step</p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-ink">Press Send in WhatsApp</h1>
        <p className="mt-2 text-muted">
          Order <span className="font-semibold text-ink">{placed.orderNo}</span> for design #{sample.designNumber} — {placed.pcs} pcs, {inr(placed.amount)}.
        </p>
        <div className="mt-4 rounded-xl bg-gold-50 px-4 py-3 text-left text-sm text-ink ring-1 ring-gold-100">
          <p>
            WhatsApp opens the chat with <b>{seller?.name || 'GFive'}</b>{placed.to ? ` (+${placed.to})` : ''} with your order and the design photo.
            Please press <b>Send</b> there so we receive it.
          </p>
          {sendState === 'shared' && <p className="mt-2 text-leaf-800">Photo shared — press Send in WhatsApp.</p>}
        </div>
        {photos[0] && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={cldThumb(photos[0], 300, 375)} alt={`Design ${sample.designNumber}`} className="mx-auto mt-4 h-40 rounded-xl object-cover ring-1 ring-line" />
        )}
        <div className="mt-5 grid gap-3">
          <a href={waLink(placed.text, placed.to)} className="btn btn-whatsapp h-12">
            <MessageCircle size={18} /> Open WhatsApp chat with {seller?.name || 'GFive'}
          </a>
          {phoneShare && (
            <button className="btn btn-outline" onClick={() => sendPhotoAttachment(placed.text)} disabled={sendState === 'sending'}>
              {sendState === 'sending' ? <Loader2 size={16} className="animate-spin" /> : null}
              Send photo as attachment instead
            </button>
          )}
          <button
            className="btn btn-ghost"
            onClick={() => {
              setPlaced(null);
              setQty(Object.fromEntries(colors.map((col) => [col.name, 0])));
            }}
          >
            Place another order for this design
          </button>
        </div>
      </div>
    );
  }

  const move = (d: number) => photos.length && setActive((i) => (i + d + photos.length) % photos.length);

  // ---------- call back → lead for the Sales Person behind this link
  const requestCallBack = async () => {
    if (!sample) return;
    const mobile = digitsOnly(c.mobile);
    if (mobile.length < 10) {
      setCbErr('Please enter your mobile number above.');
      document.getElementById('details')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setCbErr(null);
    setCb('busy');
    try {
      await createLead({
        name: c.firmName.trim(),
        phone: mobile.length === 10 ? `91${mobile}` : mobile,
        city: c.city.trim(),
        message: c.remarks.trim() || `Call back about Design #${sample.designNumber}`,
        designId: sample.id,
        designNumber: String(sample.designNumber),
        category: normCategory(sample.category),
        qty: totalPcs,
        sellerUid: seller?.uid || '',
        sellerName: seller?.name || '',
        refUid: new URLSearchParams(window.location.search).get('ref') || '',
        via: (['instagram', 'facebook'] as const).find((x) => x === new URLSearchParams(window.location.search).get('from')) || '',
      });
      saveCustomer({ ...c, remarks: '' });
      setCb('done');
    } catch (err) {
      console.error(err);
      setCbErr('Could not send. Please try again or WhatsApp us.');
      setCb('idle');
    }
  };

  return (
    <div className="pb-28 md:pb-0">
      <div className="mx-auto mt-4 grid max-w-5xl gap-6 px-4 md:mt-8 md:grid-cols-[1fr_1fr] lg:gap-10">
        {/* ---------- Gallery */}
        <div className="md:sticky md:top-24 md:self-start">
          <div
            className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-sand"
            onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchX.current === null) return;
              const dx = e.changedTouches[0].clientX - touchX.current;
              touchX.current = null;
              if (Math.abs(dx) > 40) move(dx < 0 ? 1 : -1);
            }}
          >
            {photos[active] && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={photos[active]}
                src={cldThumb(photos[active], 1100, 1375)}
                alt={`Design ${sample.designNumber}`}
                width={1100}
                height={1375}
                fetchPriority={active === 0 ? 'high' : undefined}
                className={`size-full cursor-zoom-in object-cover ${active === 0 ? '' : 'animate-fade-up'}`}
                onClick={() => setViewer(active)}
              />
            )}
            <button
              onClick={() => setViewer(active)}
              className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 text-xs font-medium text-ink shadow backdrop-blur"
            >
              <Expand size={13} /> Tap to zoom
            </button>
            {photos[active] && (
              <span className={`absolute bottom-3 left-3 rounded-full px-3 py-1.5 text-xs font-medium shadow backdrop-blur ${isAiPhoto(sample, photos[active]) ? 'bg-gold-600/90 text-white' : 'bg-white/85 text-ink'}`}>
                {isAiPhoto(sample, photos[active]) ? 'AI generated' : 'Original photo'}
              </span>
            )}
            {photos.length > 1 && (
              <>
                <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[13px] text-white backdrop-blur">
                  {active + 1} / {photos.length}
                </span>
                <button onClick={() => move(-1)} className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow" aria-label="Previous photo">
                  <ChevronLeft size={20} />
                </button>
                <button onClick={() => move(1)} className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow" aria-label="Next photo">
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>
          {photos.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {photos.map((p, i) => (
                <button key={p} onClick={() => setActive(i)} aria-label={`Show photo ${i + 1}`} aria-pressed={i === active} className="w-16 shrink-0 text-center">
                  <span className={`block h-20 w-16 overflow-hidden rounded-lg border-2 ${i === active ? 'border-gold-500' : 'border-transparent opacity-60'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cldThumb(p, 128, 160)} alt="" width={64} height={80} loading="lazy" className="size-full object-cover" />
                  </span>
                  <span className={`mt-1 block text-[12px] leading-tight ${isAiPhoto(sample, p) ? 'font-medium text-gold-600' : 'text-muted'}`}>
                    {isAiPhoto(sample, p) ? 'AI generated' : 'Original'}
                  </span>
                </button>
              ))}
            </div>
          )}
          {sample.videoUrl && (
            <figure className="mt-4">
              <video src={sample.videoUrl} controls playsInline preload="metadata" poster={cldThumb(photos.find((p) => isAiPhoto(sample, p)) || photos[0], 720, 1280)} className="mx-auto max-h-[70vh] w-full rounded-2xl bg-black object-contain" />
              <figcaption className="mt-1.5 text-center text-xs font-medium text-gold-600">AI generated video</figcaption>
            </figure>
          )}
        </div>

        {/* ---------- Details + order */}
        <div>
          <p className="eyebrow">{categoryName(sample.category) ? `${categoryName(sample.category)} · Unstitched suit` : 'Unstitched suit'}</p>
          <div className="mt-1 flex items-start justify-between gap-4">
            <h1 className="font-display text-4xl font-semibold leading-none text-ink sm:text-5xl">#{sample.designNumber}</h1>
            <button
              onClick={async () => {
                if (navigator.share) {
                  try {
                    await navigator.share({ title: `GFive Design #${sample.designNumber}`, url: window.location.href });
                  } catch {
                    /* cancelled */
                  }
                } else {
                  await navigator.clipboard.writeText(window.location.href);
                }
              }}
              className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-white text-leaf-800"
              aria-label="Share"
            >
              <Share2 size={17} />
            </button>
          </div>
          <p className="mt-3 text-3xl font-semibold text-leaf-700">
            {inr(price)} <span className="text-base font-normal text-muted">per piece</span>
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line text-sm">
            {[
              ['Category', categoryName(sample.category)],
              ['Fabric', sample.fabric],
              ['Work', sample.work],
              ['Rate', `${inr(price)} / pc`],
            ].map(([k, v]) => (
              <div key={k} className="bg-ivory px-4 py-3">
                <dt className="text-[13px] uppercase tracking-[0.14em] text-muted">{k}</dt>
                <dd className="mt-0.5 font-medium text-ink">{v || '—'}</dd>
              </div>
            ))}
          </dl>
          {sample.description && <p className="mt-4 text-[17px] leading-relaxed text-ink/80">{sample.description}</p>}
          {seller?.name && (
            <p className="mt-3 text-sm text-muted">
              Sales Person: <span className="font-medium text-ink">{seller.name}</span>
            </p>
          )}

          {/* Colours & quantity */}
          <section id="colours" className="card mt-6 scroll-mt-24 p-4 sm:p-5">
            <h2 className="font-display text-2xl font-semibold text-ink">Select quantity (pieces)</h2>
            <p className="text-sm text-muted">Tap a colour photo to see it large.</p>
            <ul className="mt-3 divide-y divide-line">
              {colors.map((col) => (
                <li key={col.name} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {col.photoUrl ? (
                      <button
                        onClick={() => setViewer(viewerPhotos.indexOf(col.photoUrl))}
                        className="size-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-line hover:ring-2 hover:ring-gold-500"
                        aria-label={`View ${col.name} photo`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={cldThumb(col.photoUrl, 120, 120)} alt={col.name} className="size-full object-cover" />
                      </button>
                    ) : (
                      <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-sand text-gold-600">
                        <Palette size={20} />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{col.name}</p>
                      <p className="text-xs text-muted">{qty[col.name] ? inr((qty[col.name] || 0) * price) : '—'}</p>
                    </div>
                  </div>
                  <QtyStepper
                    label={col.name}
                    value={qty[col.name] || 0}
                    onChange={(v) => {
                      setQty((p) => ({ ...p, [col.name]: v }));
                      if (errors.qty) setErrors((e) => ({ ...e, qty: undefined }));
                    }}
                  />
                </li>
              ))}
            </ul>
            {errors.qty && <p className="mt-1 text-sm text-red-700">{errors.qty}</p>}
            <div className="mt-2 flex items-center justify-between border-t border-dashed border-line pt-4">
              <span className="text-sm text-muted">Total</span>
              <span className="text-lg font-semibold text-ink">
                {totalPcs} pcs <span className="text-leaf-700">· {inr(totalAmt)}</span>
              </span>
            </div>
          </section>

          {/* Firm details */}
          <section id="details" className="card mt-5 scroll-mt-24 p-4 sm:p-5">
            <h2 className="font-display text-2xl font-semibold text-ink">Your firm details</h2>
            <p className="text-sm text-muted">Saved on this phone for your next order.</p>
            <div className="mt-4 space-y-3">
              <Field label="Firm / Company name *" error={errors.firmName}>
                <input className="input" value={c.firmName} onChange={(e) => set('firmName', e.target.value)} autoComplete="organization" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mobile *" error={errors.mobile}>
                  <input className="input" type="tel" inputMode="tel" value={c.mobile} onChange={(e) => set('mobile', e.target.value)} autoComplete="tel" />
                </Field>
                <Field label="City *" error={errors.city}>
                  <input className="input" value={c.city} onChange={(e) => set('city', e.target.value)} autoComplete="address-level2" />
                </Field>
              </div>
              <Field label="GST no. (optional)">
                <input className="input uppercase" value={c.gstNo} onChange={(e) => set('gstNo', e.target.value)} />
              </Field>
              <Field label="Agent name (optional)">
                <input className="input" value={c.agentName} onChange={(e) => set('agentName', e.target.value)} />
              </Field>
              <Field label="Remarks (optional)">
                <textarea className="input" rows={2} value={c.remarks} onChange={(e) => set('remarks', e.target.value)} placeholder="Delivery date, packing, etc." />
              </Field>
            </div>
            {failMsg && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{failMsg}</p>}
            <button onClick={placeOrder} disabled={busy} className="btn btn-whatsapp mt-5 hidden h-13 w-full text-[17px] md:flex">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />}
              {busy ? 'Placing order…' : `Place order on WhatsApp · ${totalPcs} pcs`}
            </button>
          </section>

          {/* Call back (becomes a lead) */}
          <section className="card mt-5 p-4 sm:p-5">
            <h2 className="font-display text-xl font-semibold text-ink">Not ready to order yet?</h2>
            <p className="text-sm text-muted">Ask for a call back — {seller?.name || 'our team'} will call you about rate, colours and delivery.</p>
            {cb === 'done' ? (
              <p className="mt-3 flex items-center gap-2 rounded-lg bg-leaf-50 px-3 py-2 text-sm text-leaf-800"><CheckCircle2 size={16} /> Thank you! We will call you soon.</p>
            ) : (
              <>
                <p className="mt-2 text-xs text-muted">Uses the firm name, mobile and city above{totalPcs ? ` · ${totalPcs} pcs selected` : ''}.</p>
                <button onClick={requestCallBack} disabled={cb === 'busy'} className="btn btn-outline mt-3 w-full">
                  {cb === 'busy' ? <Loader2 size={16} className="animate-spin" /> : <Phone size={16} />} Request a call back
                </button>
                {cbErr && <p className="mt-2 text-sm text-red-700">{cbErr}</p>}
              </>
            )}
          </section>
        </div>
      </div>

      {/* Mobile sticky bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ivory/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur md:hidden">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted">{totalPcs} pcs selected</span>
          <span className="font-semibold text-ink">{inr(totalAmt)}</span>
        </div>
        <button onClick={placeOrder} disabled={busy} className="btn btn-whatsapp h-12 w-full text-[17px]">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />}
          {busy ? 'Placing order…' : 'Place order on WhatsApp'}
        </button>
      </div>

      {viewer !== null && viewer >= 0 && (
        <Lightbox
          images={viewerPhotos}
          index={viewer}
          onIndexChange={setViewer}
          onClose={() => setViewer(null)}
          caption={(i) => (isAiPhoto(sample, viewerPhotos[i]) ? 'AI generated' : colors.find((col) => col.photoUrl === viewerPhotos[i])?.name || 'Original photo')}
        />
      )}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  );
}
