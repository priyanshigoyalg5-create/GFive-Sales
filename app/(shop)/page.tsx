'use client';

import { useMemo, useState } from 'react';
import { Search, X, BadgeCheck, Truck, HandHeart, MessageCircle, ArrowRight, MousePointerClick, ShoppingBag, Send } from 'lucide-react';
import { useSamples } from '@/lib/hooks';
import { useCart, itemPcs } from '@/lib/cart';
import { useSettings } from '@/lib/settings';
import { COLLECTIONS } from '@/lib/collections';
import { cldThumb } from '@/lib/format';
import { samplePhotos } from '@/lib/samples';
import ProductCard, { ProductCardSkeleton } from '@/components/shop/ProductCard';

type Sort = 'new' | 'low' | 'high';

function uniq(values: (string | undefined)[]) {
  const map = new Map<string, string>();
  values.forEach((v) => {
    const t = (v || '').trim();
    if (t && !map.has(t.toLowerCase())) map.set(t.toLowerCase(), t);
  });
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
}

const PROMISES = [
  { icon: HandHeart, title: 'Kolkata karigari', text: 'Hand embroidery by our own artisans' },
  { icon: BadgeCheck, title: 'Gfive standard', text: 'Every piece checked before dispatch' },
  { icon: Truck, title: 'Fast dispatch', text: 'Ready stock ships within 24–48 hrs' },
  { icon: MessageCircle, title: 'Order on WhatsApp', text: 'No app, no sign-up needed' },
];

export default function CatalogPage() {
  const { samples, loading, error } = useSamples();
  const cart = useCart();
  const settings = useSettings();
  const [q, setQ] = useState('');
  const [coll, setColl] = useState<string | null>(null);
  const [fabric, setFabric] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('new');

  const active = useMemo(() => samples.filter((s) => !s.isTrashed), [samples]);
  const fabrics = useMemo(() => uniq(active.map((s) => s.fabric)), [active]);
  const collCovers = useMemo(() => {
    const m: Record<string, string> = {};
    active.forEach((s) => {
      if (s.collection && !m[s.collection]) m[s.collection] = samplePhotos(s)[0] || '';
    });
    return m;
  }, [active]);
  const collCount = useMemo(() => {
    const m: Record<string, number> = {};
    active.forEach((s) => s.collection && (m[s.collection] = (m[s.collection] || 0) + 1));
    return m;
  }, [active]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = active.filter((s) => {
      if (coll && s.collection !== coll) return false;
      if (fabric && (s.fabric || '').trim().toLowerCase() !== fabric.toLowerCase()) return false;
      if (!term) return true;
      return [s.designNumber, s.fabric, s.work, ...(s.colors || [])].some((v) => String(v || '').toLowerCase().includes(term));
    });
    if (sort === 'low') list.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === 'high') list.sort((a, b) => Number(b.price) - Number(a.price));
    return list;
  }, [active, q, coll, fabric, sort]);

  const filtersOn = !!(coll || fabric || q);
  const pickCollection = (id: string) => {
    setColl(coll === id ? null : id);
    document.getElementById('designs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div>
      {/* ---------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden bg-weave text-ivory">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:py-16 md:grid-cols-[1.1fr_1fr]">
          <div className="text-center md:text-left">
            <p className="eyebrow !text-gold-400">Gfive Kolkata · Wholesale &amp; trade orders</p>
            <h1 className="mt-4 font-display text-[44px] font-semibold leading-[1.02] sm:text-6xl lg:text-7xl">
              Kolkata&apos;s <span className="gold-text italic">karigari</span>,<br className="hidden sm:block" /> straight to your store.
            </h1>
            <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-ivory/75 md:mx-0">
              Designer unstitched suits from our Park Street studio. Pick a design, choose pieces in every colour and send your order to us on WhatsApp in under a minute.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3 md:justify-start">
              <a href="#designs" className="btn btn-gold h-12 px-7">
                Browse designs <ArrowRight size={17} />
              </a>
              <a href={`https://wa.me/${settings.whatsappNumber}`} target="_blank" className="btn h-12 border border-ivory/25 px-6 text-ivory hover:bg-white/10">
                <MessageCircle size={17} /> Talk to us
              </a>
            </div>
          </div>

          {/* collage of the latest designs */}
          <div className="relative mx-auto hidden h-[420px] w-full max-w-md md:block">
            {active.slice(0, 3).map((s, i) => {
              const pos = ['left-0 top-6 w-[54%] rotate-[-4deg]', 'right-0 top-0 w-[50%] rotate-[3deg]', 'left-[24%] bottom-0 w-[52%] rotate-[1deg]'][i];
              return (
                <a
                  key={s.id}
                  href={`/s/${s.id}`}
                  className={`absolute ${pos} aspect-[4/5] overflow-hidden rounded-2xl border-4 border-ivory/90 shadow-lift transition hover:z-10 hover:rotate-0 hover:scale-[1.03]`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cldThumb(samplePhotos(s)[0], 500, 625)} alt={`Design ${s.designNumber}`} className="size-full object-cover" />
                </a>
              );
            })}
            {!loading && active.length === 0 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/brand/logo-round.png" alt="" className="absolute inset-0 m-auto size-72 rounded-full opacity-90" />
            )}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- Promises */}
      <section className="border-b border-line bg-ivory">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-5 px-4 py-6 md:grid-cols-4">
          {PROMISES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-50 text-gold-600 ring-1 ring-gold-100">
                <Icon size={18} />
              </span>
              <div>
                <p className="text-sm font-medium text-ink">{title}</p>
                <p className="text-xs leading-snug text-muted">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- Collections */}
      <section className="mx-auto max-w-6xl px-4 pt-14">
        <div className="text-center">
          <p className="eyebrow">The Gfive collection</p>
          <h2 className="mt-2 font-display text-4xl font-semibold text-ink sm:text-5xl">Four lines, one standard</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">From everyday ease to occasion craftsmanship — pick a line to see its designs.</p>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {COLLECTIONS.map((c) => {
            const cover = collCovers[c.id];
            const on = coll === c.id;
            return (
              <button
                key={c.id}
                onClick={() => pickCollection(c.id)}
                className={`group relative aspect-[3/4] overflow-hidden rounded-2xl text-left shadow-soft transition ${on ? 'ring-2 ring-gold-500 ring-offset-2 ring-offset-cream' : ''}`}
              >
                {cover ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={cldThumb(cover, 500, 667)} alt="" className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-105" />
                ) : (
                  <div className={`absolute inset-0 bg-gradient-to-br ${c.tone}`} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#10200a]/85 via-[#10200a]/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-ivory">
                  <p className="font-display text-3xl font-semibold leading-none sm:text-4xl">{c.name}</p>
                  <p className="mt-1 text-[13px] text-ivory/85">{c.tagline}</p>
                  <p className="mt-2 inline-flex items-center gap-1 text-[12px] tracking-wide text-gold-100">
                    {collCount[c.id] ? `${collCount[c.id]} design${collCount[c.id] > 1 ? "s" : ""}` : c.range} <ArrowRight size={13} className="transition group-hover:translate-x-1" />
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ---------------------------------------------------------- Designs */}
      <section id="designs" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">{coll ? 'Collection' : 'New arrivals'}</p>
            <h2 className="mt-1 font-display text-4xl font-semibold text-ink">
              {coll ? COLLECTIONS.find((c) => c.id === coll)?.name : 'All designs'}
            </h2>
          </div>
          <div className="flex w-full items-center gap-2 rounded-full border border-line bg-white p-1 pl-4 sm:w-80">
            <Search size={17} className="shrink-0 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Design no., fabric, colour…"
              className="h-9 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted/70"
            />
            {q && (
              <button onClick={() => setQ('')} className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-sand" aria-label="Clear search">
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            <button onClick={() => { setColl(null); setFabric(null); }} className={`chip shrink-0 ${!coll && !fabric ? 'chip-active' : ''}`}>
              All
            </button>
            {COLLECTIONS.filter((c) => collCount[c.id]).map((c) => (
              <button key={c.id} onClick={() => setColl(coll === c.id ? null : c.id)} className={`chip shrink-0 ${coll === c.id ? 'chip-active' : ''}`}>
                {c.name}
              </button>
            ))}
            {fabrics.length > 0 && <span className="mx-1 h-5 w-px shrink-0 bg-line" />}
            {fabrics.map((f) => (
              <button key={f} onClick={() => setFabric(fabric === f ? null : f)} className={`chip shrink-0 ${fabric === f ? 'chip-active' : ''}`}>
                {f}
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 text-sm text-muted sm:justify-end">
            <span>{loading ? 'Loading…' : `${shown.length} design${shown.length === 1 ? '' : 's'}`}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-9 rounded-full border border-line bg-white px-3 text-sm text-ink outline-none focus:border-leaf-600"
              aria-label="Sort"
            >
              <option value="new">Newest first</option>
              <option value="low">Price: low to high</option>
              <option value="high">Price: high to low</option>
            </select>
          </div>
        </div>

        <div className="gold-rule mt-5" />
        {error && <p className="mt-10 text-center text-red-700">{error}</p>}

        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : shown.map((s) => {
                const ci = cart.get(s.id);
                return <ProductCard key={s.id} sample={s} inCartPcs={ci ? itemPcs(ci) : 0} />;
              })}
        </div>

        {!loading && shown.length === 0 && (
          <div className="mx-auto mt-2 max-w-sm rounded-2xl border border-dashed border-line p-10 text-center">
            <p className="font-display text-2xl text-ink">No designs found</p>
            <p className="mt-1 text-sm text-muted">{filtersOn ? 'Try a different search or filter.' : 'New designs are coming soon.'}</p>
            {filtersOn && (
              <button className="btn btn-outline btn-sm mt-4" onClick={() => { setQ(''); setColl(null); setFabric(null); }}>
                Clear filters
              </button>
            )}
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------- How it works */}
      <section className="mx-auto mt-20 max-w-6xl px-4">
        <div className="overflow-hidden rounded-3xl border border-line bg-ivory">
          <div className="grid md:grid-cols-[1fr_2fr]">
            <div className="bg-sand/60 p-8">
              <p className="eyebrow">Ordering made simple</p>
              <h2 className="mt-2 font-display text-4xl font-semibold leading-tight text-ink">Three taps to place a trade order</h2>
              <p className="mt-3 text-sm text-muted">Your firm details are remembered on your phone, so repeat orders take seconds.</p>
            </div>
            <ol className="grid gap-px bg-line sm:grid-cols-3">
              {[
                { icon: MousePointerClick, t: 'Choose a design', d: 'Zoom into every photo and colour.' },
                { icon: ShoppingBag, t: 'Set pieces per colour', d: 'Add several designs to one cart.' },
                { icon: Send, t: 'Send on WhatsApp', d: 'We confirm and dispatch your order.' },
              ].map(({ icon: Icon, t, d }, i) => (
                <li key={t} className="bg-ivory p-6">
                  <span className="font-display text-5xl font-semibold text-gold-100">0{i + 1}</span>
                  <Icon size={20} className="mt-2 text-leaf-700" />
                  <p className="mt-2 font-medium text-ink">{t}</p>
                  <p className="text-sm text-muted">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
