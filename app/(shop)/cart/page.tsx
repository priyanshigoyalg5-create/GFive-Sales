'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Trash2, ShoppingBag, MessageCircle, CheckCircle2, Loader2, Share2, ArrowLeft } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useCart, itemPcs, cartItemToLine, loadCustomer, saveCustomer } from '@/lib/cart';
import { useSettings } from '@/lib/settings';
import { cldThumb, inr, digitsOnly } from '@/lib/format';
import { buildOrderWhatsAppText, nextOrderNumber, type CustomerDetails } from '@/lib/orders';
import type { OrderLine } from '@/lib/types';
import QtyStepper from '@/components/QtyStepper';

const EMPTY: CustomerDetails = { firmName: '', mobile: '', city: '', gstNo: '', agentName: '', remarks: '' };

interface Placed {
  orderNo: string;
  lines: OrderLine[];
  text: string;
  totalPcs: number;
  totalAmt: number;
}

export default function CartPage() {
  const cart = useCart();
  const settings = useSettings();
  const [c, setC] = useState<CustomerDetails>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerDetails, string>>>({});
  const [busy, setBusy] = useState(false);
  const [failMsg, setFailMsg] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Placed | null>(null);

  useEffect(() => {
    // localStorage is only available after hydration
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setC(loadCustomer({ ...EMPTY }));
  }, []);

  const lines = useMemo(() => cart.items.map(cartItemToLine).filter((l) => l.totalQuantity > 0), [cart.items]);
  const totalPcs = lines.reduce((a, l) => a + l.totalQuantity, 0);
  const totalAmt = lines.reduce((a, l) => a + l.totalAmount, 0);

  const set = (k: keyof CustomerDetails, v: string) => {
    setC((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const waLink = (text: string) => `https://api.whatsapp.com/send?phone=${settings.whatsappNumber}&text=${encodeURIComponent(text)}`;

  const placeOrder = async () => {
    const e: typeof errors = {};
    if (!c.firmName.trim()) e.firmName = 'Firm name is required';
    if (digitsOnly(c.mobile).length < 10) e.mobile = 'Enter a valid 10-digit mobile number';
    if (!c.city.trim()) e.city = 'City is required';
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById('details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (!lines.length) return;

    setBusy(true);
    setFailMsg(null);
    try {
      const orderNo = await nextOrderNumber();
      const clean: CustomerDetails = {
        firmName: c.firmName.trim(),
        mobile: c.mobile.trim(),
        city: c.city.trim(),
        gstNo: c.gstNo.trim().toUpperCase(),
        agentName: c.agentName.trim(),
        remarks: c.remarks.trim(),
      };
      const single = lines.length === 1 ? lines[0] : null;
      await addDoc(collection(db, 'orders'), {
        orderId: orderNo,
        lines,
        // Legacy top-level fields keep older screens & searches working
        sampleId: lines[0].sampleId,
        designNumber: lines.map((l) => l.designNumber).join(', '),
        designNumbers: lines.map((l) => l.designNumber),
        price: single ? single.price : null,
        items: single ? single.items : {},
        colorPhotos: single ? single.colorPhotos : {},
        salesPerson: Array.from(new Set(lines.map((l) => l.salesPerson).filter(Boolean))).join(', ') || 'N/A',
        ...clean,
        totalQuantity: totalPcs,
        totalAmount: totalAmt,
        unit: 'pcs',
        status: 'Pending',
        isTrashed: false,
        source: 'web',
        createdAt: serverTimestamp(),
      });
      saveCustomer({ ...clean, remarks: '' });
      const text = buildOrderWhatsAppText(orderNo, lines, clean, window.location.origin);
      setPlaced({ orderNo, lines, text, totalPcs, totalAmt });
      cart.clear();
      window.scrollTo({ top: 0 });
      window.location.assign(waLink(text));
    } catch (err) {
      console.error(err);
      setFailMsg('Could not place the order. Please check your internet and try again.');
    } finally {
      setBusy(false);
    }
  };

  const shareWithPhotos = async () => {
    if (!placed) return;
    try {
      const files = await Promise.all(
        placed.lines.slice(0, 6).map(async (l) => {
          const r = await fetch(l.image || '');
          const b = await r.blob();
          return new File([b], `Design_${l.designNumber}.jpg`, { type: b.type || 'image/jpeg' });
        }),
      );
      if (navigator.share && navigator.canShare?.({ files })) {
        await navigator.share({ text: placed.text, files });
        return;
      }
    } catch {
      /* fall through */
    }
    window.location.assign(waLink(placed.text));
  };

  // ----------------------------------------------------------- success
  if (placed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-14 text-center animate-fade-up">
        <CheckCircle2 size={56} className="mx-auto text-leaf-600" strokeWidth={1.5} />
        <p className="eyebrow mt-5">Order placed</p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-ink">Thank you!</h1>
        <p className="mt-2 text-muted">
          Your order <span className="font-semibold text-ink">{placed.orderNo}</span> has been received — {placed.totalPcs} pcs, {inr(placed.totalAmt)}.
          If WhatsApp did not open, tap the button below to send it to us.
        </p>
        <div className="card mt-6 divide-y divide-line text-left">
          {placed.lines.map((l) => (
            <div key={l.sampleId} className="flex items-center gap-3 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cldThumb(l.image, 96, 120)} alt="" className="h-14 w-11 rounded-lg object-cover" />
              <div className="flex-1 text-sm">
                <p className="font-medium text-ink">#{l.designNumber}</p>
                <p className="text-muted">{Object.entries(l.items).map(([k, v]) => `${k} ${v}`).join(' · ')}</p>
              </div>
              <p className="text-sm font-semibold">{inr(l.totalAmount)}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-3">
          <a href={waLink(placed.text)} className="btn btn-whatsapp h-12">
            <MessageCircle size={18} /> Send order on WhatsApp
          </a>
          <button onClick={shareWithPhotos} className="btn btn-outline h-12">
            <Share2 size={17} /> Share order with photos
          </button>
          <Link href="/" className="btn btn-ghost">Continue shopping</Link>
        </div>
      </div>
    );
  }

  if (!cart.ready) return <div className="py-24 text-center text-muted">Loading cart…</div>;

  // ----------------------------------------------------------- empty
  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-sand text-gold-600">
          <ShoppingBag size={28} />
        </span>
        <h1 className="mt-5 font-display text-3xl font-semibold text-ink">Your cart is empty</h1>
        <p className="mt-2 text-muted">Open any design, pick the pieces you want for each colour and tap “Add to cart”.</p>
        <Link href="/" className="btn btn-primary mt-6">Browse collection</Link>
      </div>
    );
  }

  // ----------------------------------------------------------- cart
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-leaf-800">
        <ArrowLeft size={15} /> Continue shopping
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold text-ink">Your cart</h1>
      <p className="text-sm text-muted">
        {cart.items.length} design{cart.items.length > 1 ? 's' : ''} · {totalPcs} pcs
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_400px]">
        {/* Items */}
        <div className="space-y-4">
          {cart.items.map((item) => {
            const pcs = itemPcs(item);
            const colorList = item.colors?.length ? item.colors : Object.keys(item.qty);
            return (
              <article key={item.sampleId} className="card overflow-hidden">
                <div className="flex gap-4 p-4">
                  <Link href={`/s/${item.sampleId}`} className="h-32 w-26 shrink-0 overflow-hidden rounded-xl bg-sand sm:h-36 sm:w-28">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cldThumb(item.image, 240, 300)} alt={`Design ${item.designNumber}`} className="size-full object-cover" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link href={`/s/${item.sampleId}`} className="font-display text-2xl font-semibold leading-tight text-ink hover:text-leaf-700">
                          #{item.designNumber}
                        </Link>
                        <p className="text-sm text-muted">{[item.fabric, item.work].filter(Boolean).join(' · ') || 'Unstitched suit'}</p>
                        <p className="mt-1 text-sm text-ink">{inr(item.price)} / pc</p>
                      </div>
                      <button
                        onClick={() => cart.remove(item.sampleId)}
                        className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-red-50 hover:text-red-700"
                        aria-label={`Remove design ${item.designNumber}`}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                    <p className="mt-3 text-sm">
                      <span className="text-muted">Subtotal </span>
                      <span className="font-semibold text-leaf-700">
                        {pcs} pcs · {inr(pcs * item.price)}
                      </span>
                    </p>
                  </div>
                </div>
                <ul className="grid gap-px border-t border-line bg-line sm:grid-cols-2">
                  {colorList.map((color) => (
                    <li key={color} className="flex items-center justify-between gap-2 bg-ivory px-4 py-2.5">
                      <span className="flex min-w-0 items-center gap-2 text-sm">
                        {item.colorPhotos[color] ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={cldThumb(item.colorPhotos[color], 64, 64)} alt="" className="size-7 rounded-md object-cover" />
                        ) : (
                          <span className="size-7 rounded-md bg-sand" />
                        )}
                        <span className="truncate">{color}</span>
                      </span>
                      <QtyStepper size="sm" label={color} value={item.qty[color] || 0} onChange={(v) => cart.setQty(item.sampleId, color, v)} />
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        {/* Checkout */}
        <aside id="details" className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <h2 className="font-display text-2xl font-semibold text-ink">Firm details</h2>
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

            <div className="mt-5 space-y-2 rounded-xl bg-sand/60 p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted">Designs</span><span>{lines.length}</span></div>
              <div className="flex justify-between"><span className="text-muted">Total pieces</span><span>{totalPcs} pcs</span></div>
              <div className="flex justify-between border-t border-line pt-2 text-base">
                <span className="font-medium">Total amount</span>
                <span className="font-semibold text-leaf-700">{inr(totalAmt)}</span>
              </div>
            </div>

            {failMsg && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{failMsg}</p>}

            <button onClick={placeOrder} disabled={busy || totalPcs === 0} className="btn btn-whatsapp mt-4 h-13 w-full text-[15px]">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />}
              {busy ? 'Placing order…' : `Place order on WhatsApp · ${totalPcs} pcs`}
            </button>
            {totalPcs === 0 && <p className="mt-2 text-center text-xs text-red-700">Add pieces to at least one colour.</p>}
          </div>
        </aside>
      </div>
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
