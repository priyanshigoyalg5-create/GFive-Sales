'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, MessageCircle, Send } from 'lucide-react';
import { createLead, getPublicStaff, latestSamples, usePublicSettings } from '@/lib/public-db';
import { cldThumb, digitsOnly, inr } from '@/lib/format';
import { samplePhotos } from '@/lib/sample-photos';
import { CATEGORIES, categoryName, normCategory } from '@/lib/categories';
import { loadCustomer, saveCustomer } from '@/lib/customer';
import type { PublicStaff, Sample } from '@/lib/types';

/**
 * Link-in-bio page for Instagram / Facebook:
 *   /enquiry?from=instagram   /enquiry?from=facebook   (optional &ref=<Sales Person uid>)
 * Shows the newest designs and an enquiry form. Every enquiry becomes a Lead.
 */
export default function EnquiryPage() {
  return (
    <Suspense fallback={<div className="grid place-items-center py-24"><Loader2 className="animate-spin text-leaf-700" /></div>}>
      <Enquiry />
    </Suspense>
  );
}

function Enquiry() {
  const settings = usePublicSettings();
  const params = useSearchParams();
  const from = params.get('from') === 'facebook' ? 'facebook' : params.get('from') === 'instagram' ? 'instagram' : '';
  const ref = params.get('ref') || '';
  const [samples, setSamples] = useState<Sample[] | null>(null);
  const [seller, setSeller] = useState<PublicStaff | null>(null);
  const [cat, setCat] = useState('');
  const [f, setF] = useState({ name: '', mobile: '', city: '', design: '', pcs: '', message: '', cats: [] as string[], buyer: '' as '' | 'business' | 'personal' });
  useEffect(() => {
    const c = loadCustomer({ firmName: '', mobile: '', city: '' });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fill saved firm details after hydration
    setF((x) => ({ ...x, name: c.firmName || x.name, mobile: c.mobile || x.mobile, city: c.city || x.city }));
  }, []);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    latestSamples(24).then((s) => alive && setSamples(s)).catch(() => alive && setSamples([]));
    if (ref) getPublicStaff(ref).then((p) => alive && setSeller(p));
    return () => {
      alive = false;
    };
  }, [ref]);

  const shown = useMemo(() => (samples || []).filter((s) => !cat || normCategory(s.category) === cat).slice(0, 12), [samples, cat]);
  const designLink = (s: Sample) => `/s/${s.id}?${new URLSearchParams({ ...(ref ? { ref } : {}), ...(from ? { from } : {}) })}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const mobile = digitsOnly(f.mobile);
    if (!f.name.trim()) return setErr('Please write your name or firm name.');
    if (mobile.length < 10) return setErr('Please enter a valid mobile number.');
    if (!f.buyer) return setErr('Please choose: shop / boutique or personal use.');
    setErr(null);
    setState('busy');
    try {
      const d = (samples || []).find((s) => String(s.designNumber).toLowerCase() === f.design.trim().toLowerCase());
      await createLead({
        name: f.name.trim(),
        phone: mobile.length === 10 ? `91${mobile}` : mobile,
        city: f.city.trim(),
        message: [f.cats.length ? `Interested: ${f.cats.map(categoryName).join(', ')}` : '', f.message.trim()].filter(Boolean).join(' · ') || 'Enquiry from bio link',
        designId: d?.id || '',
        designNumber: d ? String(d.designNumber) : f.design.trim(),
        category: d?.category || f.cats[0] || '',
        qty: Number(f.pcs) || 0,
        sellerUid: seller?.uid || '',
        sellerName: seller?.name || '',
        refUid: seller?.uid || '',
        via: from,
        buyerType: f.buyer,
      });
      saveCustomer({ firmName: f.name.trim(), mobile, city: f.city.trim(), gstNo: '', agentName: '', remarks: '' });
      setState('done');
    } catch (e2) {
      console.error(e2);
      setErr('Could not send. Please try again or WhatsApp us.');
      setState('idle');
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-6">
      <section className="text-center">
        <p className="eyebrow">{from === 'instagram' ? 'Welcome from Instagram' : from === 'facebook' ? 'Welcome from Facebook' : 'GFive Kolkata'}</p>
        <h1 className="mt-1 font-display text-4xl font-semibold text-ink sm:text-5xl">Designer unstitched suits</h1>
        <p className="mx-auto mt-2 max-w-md text-muted">Wholesale · Kolkata. Tap a design to see all colours and order, or send an enquiry below.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <a href="#enquiry" className="btn btn-primary"><Send size={16} /> Send enquiry</a>
          {settings.whatsappNumber && (
            <a href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent('Namaste GFive, mujhe naye designs dekhne hain')}`} target="_blank" rel="noreferrer" className="btn btn-whatsapp">
              <MessageCircle size={16} /> WhatsApp us
            </a>
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Collection">
          <button onClick={() => setCat('')} aria-pressed={!cat} className={`chip ${!cat ? 'chip-active' : ''}`}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} aria-pressed={cat === c.id} className={`chip ${cat === c.id ? 'chip-active' : ''}`}>{c.name}</button>
          ))}
        </div>
        {samples === null ? (
          <div className="grid place-items-center py-16"><Loader2 className="animate-spin text-leaf-700" /></div>
        ) : shown.length === 0 ? (
          <p className="py-10 text-center text-muted">New designs coming soon.</p>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((s, i) => {
              const ph = samplePhotos(s)[0];
              return (
                <a key={s.id} href={designLink(s)} className="card overflow-hidden transition hover:shadow-lift">
                  <div className="aspect-[4/5] bg-sand">
                    {ph && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cldThumb(ph, 500, 625)} alt={`Design ${s.designNumber}`} width={500} height={625} loading={i < 4 ? 'eager' : 'lazy'} className="size-full object-cover" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-display text-lg font-semibold leading-tight">#{s.designNumber}</p>
                    <p className="text-sm text-muted">{[categoryName(s.category), s.fabric].filter(Boolean).join(' · ')}</p>
                    <p className="mt-1 font-semibold text-leaf-800">{inr(s.price)}<span className="text-xs font-normal text-muted"> / pc</span></p>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>

      <section id="enquiry" className="card mx-auto mt-10 max-w-lg scroll-mt-24 p-5">
        <h2 className="font-display text-2xl font-semibold">Send an enquiry</h2>
        <p className="text-sm text-muted">{seller ? `${seller.name} will call you back.` : 'Our Sales Person will call you back with rates and colours.'}</p>
        {state === 'done' ? (
          <div className="mt-4 rounded-xl bg-leaf-50 p-4 text-leaf-800">
            <p className="flex items-center gap-2 font-medium"><CheckCircle2 size={18} /> Thank you! We will contact you soon.</p>
            {settings.whatsappNumber && (
              <a href={`https://wa.me/${seller?.whatsappNumber || settings.whatsappNumber}`} className="btn btn-whatsapp mt-3" target="_blank" rel="noreferrer">
                <MessageCircle size={16} /> Chat on WhatsApp now
              </a>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <label className="block"><span className="field-label">Name / firm *</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="organization" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="field-label">Mobile *</span><input className="input" type="tel" inputMode="tel" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} autoComplete="tel" /></label>
              <label className="block"><span className="field-label">City</span><input className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} autoComplete="address-level2" /></label>
            </div>
            <div>
              <span className="field-label">You are buying for *</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Buying for">
                {([
                  { id: 'business', label: '🏬 Shop / boutique / wholesale' },
                  { id: 'personal', label: '🙋 Personal use' },
                ] as const).map((o) => (
                  <button type="button" key={o.id} aria-pressed={f.buyer === o.id} onClick={() => setF({ ...f, buyer: o.id })} className={`chip ${f.buyer === o.id ? 'chip-active' : ''}`}>{o.label}</button>
                ))}
              </div>
              {f.buyer === 'personal' && settings.website && (
                <p className="mt-1.5 text-xs text-muted">We mainly sell wholesale. For single pieces you can also shop at <a className="underline" href={settings.website.startsWith('http') ? settings.website : `https://${settings.website}`} target="_blank" rel="noreferrer">{settings.website}</a>.</p>
              )}
            </div>
            <div>
              <span className="field-label">Interested in</span>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => {
                  const on = f.cats.includes(c.id);
                  return (
                    <button type="button" key={c.id} aria-pressed={on} onClick={() => setF({ ...f, cats: on ? f.cats.filter((x) => x !== c.id) : [...f.cats, c.id] })} className={`chip ${on ? 'chip-active' : ''}`}>{c.name}</button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="field-label">Design no. (if any)</span><input className="input" value={f.design} onChange={(e) => setF({ ...f, design: e.target.value })} placeholder="e.g. RZ0138" /></label>
              <label className="block"><span className="field-label">Pieces</span><input className="input" type="number" min={0} inputMode="numeric" value={f.pcs} onChange={(e) => setF({ ...f, pcs: e.target.value })} /></label>
            </div>
            <label className="block"><span className="field-label">Message</span><textarea className="input" rows={2} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Rate, colours, delivery…" /></label>
            {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
            <button className="btn btn-primary h-12 w-full" disabled={state === 'busy'}>
              {state === 'busy' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send enquiry
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
