'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Search, PlusCircle, MessageCircle, Link2, Pencil, Trash2, RotateCcw, ExternalLink, Check, Images, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { useOrders, useSamples } from '@/lib/hooks';
import { cldThumb, inr } from '@/lib/format';
import { getOrderLines } from '@/lib/orders';
import { sampleColors, samplePhotos, sampleLink, shareSampleOnWhatsApp } from '@/lib/samples';
import PageHeader from '@/components/admin/PageHeader';
import { CATEGORIES, categoryName, normCategory } from '@/lib/categories';
import type { Sample } from '@/lib/types';

export default function AdminSamplesPage() {
  const { isSuper, profile } = useAuth();
  const uid = profile?.uid || '';
  const { samples, loading } = useSamples();
  const { orders } = useOrders(); // already limited to this person's own orders (all for Super Admin)
  const [tab, setTab] = useState<'mine' | 'all' | 'trash'>(isSuper ? 'all' : 'mine');
  const [cat, setCat] = useState<string>('');
  const canEdit = (s: Sample) => isSuper || (!!s.createdByUid && s.createdByUid === uid);
  const owner = (s: Sample) => s.createdByName || s.salesPerson || '';
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const pcsByDesign = useMemo(() => {
    const m = new Map<string, number>();
    orders
      .filter((o) => !o.isTrashed && o.status !== 'Cancelled')
      .forEach((o) => getOrderLines(o).forEach((l) => l.sampleId && m.set(l.sampleId, (m.get(l.sampleId) || 0) + l.totalQuantity)));
    return m;
  }, [orders]);

  const live = samples.filter((s) => !s.isTrashed);
  const activeCount = live.length;
  const mineCount = live.filter((s) => s.createdByUid === uid).length;
  // trash: own trashed samples (Super Admin sees all)
  const trashList = samples.filter((s) => s.isTrashed && canEdit(s));
  const trashCount = trashList.length;
  const base = tab === 'trash' ? trashList : tab === 'mine' ? live.filter((s) => s.createdByUid === uid) : live;
  const shown = base.filter((s) => {
    if (cat && normCategory(s.category) !== cat) return false;
    const t = q.trim().toLowerCase();
    return !t || [s.designNumber, s.fabric, s.work, owner(s), categoryName(s.category)].some((v) => String(v || '').toLowerCase().includes(t));
  });
  const selectable = shown.filter(canEdit);
  const allSel = selectable.length > 0 && selectable.every((s) => sel.includes(s.id));

  const setTrash = async (ids: string[], value: boolean) => {
    const b = writeBatch(db);
    ids.forEach((id) => b.update(doc(db, 'samples', id), { isTrashed: value }));
    await b.commit();
    setSel([]);
  };
  const destroy = async (ids: string[]) => {
    if (!confirm(`Permanently delete ${ids.length} sample(s)? This cannot be undone.`)) return;
    const b = writeBatch(db);
    ids.forEach((id) => b.delete(doc(db, 'samples', id)));
    await b.commit();
    setSel([]);
  };

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Samples"
        subtitle="Shared catalogue. Links you share carry your name, so orders from them are credited to you." 
        actions={
          <>
            <Link href="/admin/samples/new" className="btn btn-primary">
              <PlusCircle size={16} /> Add sample
            </Link>
          </>
        }
      />

      <div className="card mb-5 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search design no., fabric, work, sales person" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setTab('mine'); setSel([]); }} className={`chip h-10 px-4 ${tab === 'mine' ? 'chip-active' : ''}`}>
            My samples ({mineCount})
          </button>
          <button onClick={() => { setTab('all'); setSel([]); }} className={`chip h-10 px-4 ${tab === 'all' ? 'chip-active' : ''}`}>
            All ({activeCount})
          </button>
          <button onClick={() => { setTab('trash'); setSel([]); }} className={`chip h-10 px-4 ${tab === 'trash' ? '!border-red-700 !bg-red-700 !text-white' : ''}`}>
            <Trash2 size={14} /> Trash ({trashCount})
          </button>
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
        <button onClick={() => setCat('')} className={`chip shrink-0 ${!cat ? 'chip-active' : ''}`}>All categories</button>
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setCat(cat === c.id ? '' : c.id)} className={`chip shrink-0 ${cat === c.id ? 'chip-active' : ''}`}>
            {c.name} <span className="opacity-60">{base.filter((s) => normCategory(s.category) === c.id).length}</span>
          </button>
        ))}
      </div>

      {selectable.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 px-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-leaf-700" checked={allSel} onChange={() => setSel(allSel ? [] : selectable.map((s) => s.id))} />
            Select all{tab === 'all' && !isSuper ? ' my' : ''} ({selectable.length})
          </label>
          {sel.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-leaf-800">{sel.length} selected</span>
              {tab !== 'trash' ? (
                <button className="btn btn-sm btn-outline !text-red-700" onClick={() => setTrash(sel, true)}>
                  <Trash2 size={14} /> Move to trash
                </button>
              ) : (
                <>
                  <button className="btn btn-sm btn-outline" onClick={() => setTrash(sel, false)}>
                    <RotateCcw size={14} /> Restore
                  </button>
                  {isSuper && (
                    <button className="btn btn-sm btn-danger" onClick={() => destroy(sel)}>
                      Delete forever
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-24"><Loader2 className="animate-spin text-leaf-700" /></div>
      ) : shown.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="font-display text-2xl">{tab === 'trash' ? 'Trash is empty' : q || cat ? 'No matching samples' : tab === 'mine' ? 'You haven’t added any samples yet' : 'No samples yet'}</p>
          {tab !== 'trash' && !q && !cat && (
            <Link href="/admin/samples/new" className="btn btn-primary mt-4"><PlusCircle size={16} /> Add your first sample</Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {shown.map((s, idx) => {
            const photos = samplePhotos(s);
            const colors = sampleColors(s);
            const on = sel.includes(s.id);
            const ordered = pcsByDesign.get(s.id) || 0;
            return (
              <article key={s.id} className={`card flex flex-col overflow-hidden transition ${on ? 'ring-2 ring-leaf-600' : ''} ${s.isTrashed ? 'bg-red-50/40' : ''}`}>
                <div className="relative aspect-[4/5] bg-sand">
                  {photos[0] && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={cldThumb(photos[0], 500, 625)} alt={`Design ${s.designNumber}`} width={500} height={625} loading={idx < 4 ? 'eager' : 'lazy'} fetchPriority={idx === 0 ? 'high' : undefined} className="size-full object-cover" />
                  )}
                  {canEdit(s) && (
                    <label className="absolute left-2 top-2 grid size-8 cursor-pointer place-items-center rounded-full bg-white/90 shadow">
                      <input type="checkbox" aria-label={`Select design ${s.designNumber}`} className="size-4 accent-leaf-700" checked={on} onChange={() => setSel((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]))} />
                    </label>
                  )}
                  <span className="absolute right-2 top-2 rounded-full bg-leaf-800/90 px-2.5 py-1 text-xs font-semibold text-ivory">{inr(s.price)}</span>
                  <div className="absolute inset-x-2 bottom-2 flex justify-between text-[11px]">
                    {photos.length > 1 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-white"><Images size={11} /> {photos.length}</span>
                    ) : <span />}
                    {ordered > 0 && <span className="rounded-full bg-gold-600 px-2 py-0.5 font-medium text-white">{ordered} pcs {isSuper ? 'ordered' : 'by you'}</span>}
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-display text-xl font-semibold leading-tight">#{s.designNumber}</h2>
                    {categoryName(s.category) ? (
                      <span className="shrink-0 rounded-full bg-gold-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-600 ring-1 ring-gold-100">{categoryName(s.category)}</span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] text-red-700">No category</span>
                    )}
                  </div>
                  <p className="line-clamp-1 text-xs text-muted">{[s.fabric, s.work].filter(Boolean).join(' · ') || '—'}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {colors.slice(0, 4).map((c) => (
                      <span key={c.name} className="rounded-full bg-sand px-2 py-0.5 text-[11px]">{c.name}</span>
                    ))}
                    {colors.length > 4 && <span className="rounded-full bg-sand px-2 py-0.5 text-[11px]">+{colors.length - 4}</span>}
                  </div>
                  {owner(s) && <p className="mt-2 text-[11px] text-muted">Added by {s.createdByUid === uid ? 'you' : owner(s)}</p>}

                  <div className="mt-auto pt-3">
                    {s.isTrashed ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button className="btn btn-sm btn-outline" onClick={() => updateDoc(doc(db, 'samples', s.id), { isTrashed: false })}>
                          <RotateCcw size={14} /> Restore
                        </button>
                        {isSuper ? (
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => confirm(`Delete #${s.designNumber} forever?`) && deleteDoc(doc(db, 'samples', s.id))}
                          >
                            Delete
                          </button>
                        ) : <span />}
                      </div>
                    ) : (
                      <>
                        <button className="btn btn-sm btn-whatsapp w-full" onClick={() => shareSampleOnWhatsApp(s, uid, profile?.name)}>
                          <MessageCircle size={14} /> Share
                        </button>
                        <div className={`mt-2 grid gap-1.5 ${canEdit(s) ? 'grid-cols-4' : 'grid-cols-2'}`}>
                          <IconBtn
                            label={copied === s.id ? 'Copied' : 'Copy link'}
                            onClick={async () => {
                              await navigator.clipboard.writeText(sampleLink(s.id, uid));
                              setCopied(s.id);
                              setTimeout(() => setCopied(null), 1500);
                            }}
                          >
                            {copied === s.id ? <Check size={15} /> : <Link2 size={15} />}
                          </IconBtn>
                          <a href={sampleLink(s.id, uid)} target="_blank" className="grid h-9 place-items-center rounded-full border border-line text-leaf-800 hover:bg-leaf-50" title="Open customer link">
                            <ExternalLink size={15} />
                          </a>
                          {canEdit(s) && (
                            <>
                              <Link href={`/admin/samples/${s.id}/edit`} className="grid h-9 place-items-center rounded-full border border-line text-leaf-800 hover:bg-leaf-50" title="Edit">
                                <Pencil size={15} />
                              </Link>
                              <IconBtn label="Move to trash" danger onClick={() => updateDoc(doc(db, 'samples', s.id), { isTrashed: true })}>
                                <Trash2 size={15} />
                              </IconBtn>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

function IconBtn({ children, label, onClick, danger }: { children: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`grid h-9 place-items-center rounded-full border border-line ${danger ? 'text-red-700 hover:bg-red-50' : 'text-leaf-800 hover:bg-leaf-50'}`}
    >
      {children}
    </button>
  );
}
