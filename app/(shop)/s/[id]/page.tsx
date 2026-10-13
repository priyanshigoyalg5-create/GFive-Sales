'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Expand, Share2, ShoppingBag, Zap, Check, Palette, ArrowLeft } from 'lucide-react';
import { db } from '@/lib/firebase';
import type { Sample } from '@/lib/types';
import { cldThumb, inr } from '@/lib/format';
import { sampleColors, samplePhotos, allSamplePhotos, sampleLink } from '@/lib/samples';
import { useCart, itemPcs } from '@/lib/cart';
import { useSamples } from '@/lib/hooks';
import Lightbox from '@/components/Lightbox';
import QtyStepper from '@/components/QtyStepper';
import ProductCard from '@/components/shop/ProductCard';
import { collectionName } from '@/lib/collections';

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const cart = useCart();
  const { samples } = useSamples();

  const [sample, setSample] = useState<Sample | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');
  const [active, setActive] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<string | null>(null);
  const touchX = useRef<number | null>(null);
  const prefilled = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'samples', id));
        if (!alive) return;
        if (snap.exists() && !snap.data().isTrashed) {
          setSample({ id: snap.id, ...(snap.data() as Omit<Sample, 'id'>) });
          setState('ok');
        } else setState('missing');
      } catch {
        if (alive) setState('missing');
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  // Pre-fill quantities from the cart (once) so customers can edit what they added earlier
  useEffect(() => {
    if (!sample || !cart.ready || prefilled.current) return;
    prefilled.current = true;
    const existing = cart.get(sample.id);
    const init: Record<string, number> = {};
    sampleColors(sample).forEach((c) => (init[c.name] = existing?.qty[c.name] || 0));
    setQty(init);
  }, [sample, cart]);

  const photos = useMemo(() => (sample ? samplePhotos(sample) : []), [sample]);
  const viewerPhotos = useMemo(() => (sample ? allSamplePhotos(sample) : []), [sample]);
  const colors = useMemo(() => (sample ? sampleColors(sample) : []), [sample]);
  const sampleCollection = sample?.collection;
  const related = useMemo(() => {
    const others = samples.filter((s) => !s.isTrashed && s.id !== id);
    const same = others.filter((s) => sampleCollection && s.collection === sampleCollection);
    return [...same, ...others.filter((s) => !same.includes(s))].slice(0, 4);
  }, [samples, id, sampleCollection]);

  const totalPcs = Object.values(qty).reduce((a, b) => a + (b || 0), 0);
  const totalAmt = totalPcs * Number(sample?.price || 0);
  const inCart = sample ? cart.get(sample.id) : undefined;

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  const commit = () => {
    if (!sample) return false;
    if (totalPcs <= 0) {
      flash('Please choose pieces for at least one colour');
      document.getElementById('colours')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    const colorPhotos: Record<string, string> = {};
    colors.forEach((c) => c.photoUrl && (colorPhotos[c.name] = c.photoUrl));
    cart.upsert({
      sampleId: sample.id,
      designNumber: sample.designNumber,
      price: Number(sample.price),
      image: photos[0] || '',
      fabric: sample.fabric,
      work: sample.work,
      salesPerson: sample.salesPerson,
      colors: colors.map((c) => c.name),
      qty,
      colorPhotos,
      addedAt: Date.now(),
    });
    return true;
  };

  const share = async () => {
    if (!sample) return;
    const url = sampleLink(sample.id);
    if (navigator.share) {
      try {
        await navigator.share({ title: `GFive Design #${sample.designNumber}`, url });
        return;
      } catch {
        return;
      }
    }
    await navigator.clipboard.writeText(url);
    flash('Link copied');
  };

  if (state === 'loading') {
    return (
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-2">
        <div className="aspect-[4/5] animate-pulse rounded-3xl bg-sand" />
        <div className="space-y-4">
          <div className="h-10 w-1/2 animate-pulse rounded bg-sand" />
          <div className="h-6 w-1/3 animate-pulse rounded bg-sand" />
          <div className="h-40 animate-pulse rounded-2xl bg-sand" />
        </div>
      </div>
    );
  }

  if (state === 'missing' || !sample) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="font-display text-3xl text-ink">This design is no longer available</p>
        <p className="mt-2 text-muted">It may have been sold out or removed. Have a look at our latest collection.</p>
        <Link href="/" className="btn btn-primary mt-6">Browse collection</Link>
      </div>
    );
  }

  const move = (d: number) => photos.length && setActive((i) => (i + d + photos.length) % photos.length);

  return (
    <div className="pb-28 md:pb-0">
      <div className="mx-auto max-w-6xl px-4 pt-5">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-leaf-800">
          <ArrowLeft size={15} /> Collection
        </Link>
      </div>

      <div className="mx-auto mt-4 grid max-w-6xl gap-8 px-4 md:grid-cols-[1.1fr_1fr] lg:gap-12">
        {/* ---------- Gallery */}
        <div className="md:sticky md:top-24 md:self-start">
          <div className="flex gap-3">
            {photos.length > 1 && (
              <div className="hidden max-h-[640px] w-20 shrink-0 flex-col gap-2.5 overflow-y-auto md:flex">
                {photos.map((p, i) => (
                  <button
                    key={p}
                    onClick={() => setActive(i)}
                    className={`aspect-[4/5] overflow-hidden rounded-xl border-2 transition ${i === active ? 'border-gold-500' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cldThumb(p, 160, 200)} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div
              className="relative aspect-[4/5] flex-1 overflow-hidden rounded-3xl bg-sand"
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
                  className="size-full cursor-zoom-in object-cover animate-fade-up"
                  onClick={() => setViewer(active)}
                />
              )}
              <button
                onClick={() => setViewer(active)}
                className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 text-xs font-medium text-ink shadow backdrop-blur"
              >
                <Expand size={13} /> View full screen
              </button>
              {photos.length > 1 && (
                <>
                  <button onClick={() => move(-1)} className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow" aria-label="Previous photo">
                    <ChevronLeft size={20} />
                  </button>
                  <button onClick={() => move(1)} className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow" aria-label="Next photo">
                    <ChevronRight size={20} />
                  </button>
                  <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5 md:hidden">
                    {photos.map((p, i) => (
                      <span key={p} className={`h-1.5 rounded-full transition-all ${i === active ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          {photos.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto md:hidden">
              {photos.map((p, i) => (
                <button key={p} onClick={() => setActive(i)} className={`h-20 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${i === active ? 'border-gold-500' : 'border-transparent opacity-60'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cldThumb(p, 128, 160)} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ---------- Details */}
        <div>
          <p className="eyebrow">{collectionName(sample.collection) ? `${collectionName(sample.collection)} collection` : 'Unstitched suit'}</p>
          <div className="mt-2 flex items-start justify-between gap-4">
            <h1 className="font-display text-4xl font-semibold leading-none text-ink sm:text-5xl">#{sample.designNumber}</h1>
            <button onClick={share} className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-white text-leaf-800 hover:border-leaf-600/50" aria-label="Share">
              <Share2 size={17} />
            </button>
          </div>
          <p className="mt-4 text-3xl font-semibold text-leaf-700">
            {inr(sample.price)} <span className="text-base font-normal text-muted">per piece</span>
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line text-sm">
            {[
              ['Fabric', sample.fabric],
              ['Work', sample.work],
              ['Colours', String(colors.length)],
              ['Photos', String(viewerPhotos.length)],
            ].map(([k, v]) => (
              <div key={k} className="bg-ivory px-4 py-3">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">{k}</dt>
                <dd className="mt-0.5 font-medium text-ink">{v || '—'}</dd>
              </div>
            ))}
          </dl>
          {sample.description && <p className="mt-4 text-[15px] leading-relaxed text-ink/80">{sample.description}</p>}

          {/* Colours & qty */}
          <div id="colours" className="card mt-6 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold text-ink">Select pieces</h2>
              {inCart && (
                <span className="inline-flex items-center gap-1 rounded-full bg-leaf-50 px-2.5 py-1 text-xs text-leaf-800">
                  <Check size={12} /> {itemPcs(inCart)} pcs in cart
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted">Tap a colour photo to see it large.</p>

            <ul className="mt-4 divide-y divide-line">
              {colors.map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {c.photoUrl ? (
                      <button
                        onClick={() => setViewer(viewerPhotos.indexOf(c.photoUrl))}
                        className="size-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-line transition hover:ring-2 hover:ring-gold-500"
                        aria-label={`View ${c.name} photo`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={cldThumb(c.photoUrl, 120, 120)} alt={c.name} className="size-full object-cover" />
                      </button>
                    ) : (
                      <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-sand text-gold-600">
                        <Palette size={20} />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{c.name}</p>
                      <p className="text-xs text-muted">{qty[c.name] ? `${inr((qty[c.name] || 0) * sample.price)}` : 'Not selected'}</p>
                    </div>
                  </div>
                  <QtyStepper label={c.name} value={qty[c.name] || 0} onChange={(v) => setQty((p) => ({ ...p, [c.name]: v }))} />
                </li>
              ))}
            </ul>

            <div className="mt-2 flex items-center justify-between border-t border-dashed border-line pt-4">
              <span className="text-sm text-muted">Total</span>
              <span className="text-lg font-semibold text-ink">
                {totalPcs} pcs <span className="text-leaf-700">· {inr(totalAmt)}</span>
              </span>
            </div>

            <div className="mt-5 hidden grid-cols-2 gap-3 md:grid">
              <button className="btn btn-outline h-12" onClick={() => commit() && flash(inCart ? 'Cart updated' : 'Added to cart')}>
                <ShoppingBag size={17} /> {inCart ? 'Update cart' : 'Add to cart'}
              </button>
              <button className="btn btn-primary h-12" onClick={() => commit() && router.push('/cart')}>
                <Zap size={17} /> Order now
              </button>
            </div>
          </div>

          {sample.salesPerson && <p className="mt-4 text-sm text-muted">Your sales contact: <span className="font-medium text-ink">{sample.salesPerson}</span></p>}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mx-auto mt-16 max-w-6xl px-4">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-3xl font-semibold text-ink">More designs</h2>
            <Link href="/" className="text-sm text-leaf-700 hover:underline">View all</Link>
          </div>
          <div className="gold-rule mt-3" />
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
            {related.map((s) => (
              <ProductCard key={s.id} sample={s} />
            ))}
          </div>
        </section>
      )}

      {/* Mobile sticky bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ivory/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur md:hidden">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted">{totalPcs} pcs selected</span>
          <span className="font-semibold text-ink">{inr(totalAmt)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <button className="btn btn-outline h-12" onClick={() => commit() && flash(inCart ? 'Cart updated' : 'Added to cart')}>
            <ShoppingBag size={17} /> {inCart ? 'Update' : 'Add to cart'}
          </button>
          <button className="btn btn-primary h-12" onClick={() => commit() && router.push('/cart')}>
            <Zap size={17} /> Order now
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed inset-x-0 bottom-36 z-50 flex justify-center px-4 md:bottom-8">
          <div className="flex items-center gap-3 rounded-full bg-leaf-900 px-5 py-3 text-sm text-ivory shadow-lift animate-fade-up">
            {toast}
            {toast !== 'Link copied' && !toast.startsWith('Please') && (
              <Link href="/cart" className="font-medium text-gold-400 underline-offset-2 hover:underline">View cart</Link>
            )}
          </div>
        </div>
      )}

      {viewer !== null && viewer >= 0 && (
        <Lightbox
          images={viewerPhotos}
          index={viewer}
          onIndexChange={setViewer}
          onClose={() => setViewer(null)}
          caption={(i) => colors.find((c) => c.photoUrl === viewerPhotos[i])?.name}
        />
      )}
    </div>
  );
}
