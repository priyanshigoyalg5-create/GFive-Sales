'use client';

import { useMemo, useState } from 'react';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import {
  Search, Phone, MessageCircle, FileText, Images, Trash2, RotateCcw, Download, Loader2, Package, CalendarDays, IndianRupee, Layers, MapPin, ChevronDown,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { useOrders, useSamples } from '@/lib/hooks';
import { useSettings } from '@/lib/settings';
import { cldThumb, digitsOnly, formatDate, inr, tsToDate } from '@/lib/format';
import { displayOrderId, getOrderLines, orderCategory, orderSeller, orderStatus, ORDER_STATUSES, STATUS_STYLE } from '@/lib/orders';
import { CATEGORIES, categoryName, normCategory } from '@/lib/categories';
import { useStaffList } from '@/lib/staff';
import type { PublicStaff } from '@/lib/types';
import { allSamplePhotos } from '@/lib/samples';
import type { Order, OrderStatus } from '@/lib/types';
import PageHeader from '@/components/admin/PageHeader';
import InvoiceModal from '@/components/admin/InvoiceModal';
import Lightbox from '@/components/Lightbox';

type Tab = 'All' | OrderStatus | 'Trash';
type Range = 'all' | 'today' | '7d' | 'month';

function inRange(d: Date | null, r: Range) {
  if (r === 'all') return true;
  if (!d) return r === 'today'; // just-created orders have no server time yet
  const now = new Date();
  if (r === 'today') return d.toDateString() === now.toDateString();
  if (r === '7d') return now.getTime() - d.getTime() <= 7 * 864e5;
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export default function OrdersPage() {
  const { isSuper } = useAuth();
  const { orders: myOrders, loading, error } = useOrders(); // staff: only their own orders
  const staffList = useStaffList(isSuper);
  const [staffFilter, setStaffFilter] = useState(''); // '' = everyone, 'unassigned', or a uid
  const [catFilter, setCatFilter] = useState('');
  const orders = useMemo(
    () =>
      myOrders.filter((o) => {
        if (catFilter && normCategory(orderCategory(o)) !== catFilter) return false;
        if (!isSuper || !staffFilter) return true;
        const s = orderSeller(o);
        return staffFilter === 'unassigned' ? !s.uid : s.uid === staffFilter;
      }),
    [myOrders, catFilter, staffFilter, isSuper],
  );
  const { samples } = useSamples();
  const settings = useSettings();

  const [tab, setTab] = useState<Tab>('All');
  const [q, setQ] = useState('');
  const [range, setRange] = useState<Range>('all');
  const [sel, setSel] = useState<string[]>([]);
  const [invoice, setInvoice] = useState<Order | null>(null);
  const [gallery, setGallery] = useState<{ images: string[]; index: number } | null>(null);

  // ---------- stats (exclude trash & cancelled)
  const live = orders.filter((o) => !o.isTrashed && orderStatus(o) !== 'Cancelled');
  const today = live.filter((o) => inRange(tsToDate(o.createdAt), 'today'));
  const stats = [
    { label: 'Open orders', value: String(live.filter((o) => ['Pending', 'Dispatched'].includes(orderStatus(o))).length), icon: Package, tone: 'text-leaf-700' },
    { label: "Today's orders", value: String(today.length), icon: CalendarDays, tone: 'text-gold-600' },
    { label: 'Pieces sold', value: `${live.reduce((a, o) => a + Number(o.totalQuantity || 0), 0).toLocaleString('en-IN')} pcs`, icon: Layers, tone: 'text-sky-700' },
    { label: 'Sales value', value: inr(live.reduce((a, o) => a + Number(o.totalAmount || 0), 0)), icon: IndianRupee, tone: 'text-leaf-700' },
  ];

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: 0, Trash: 0 };
    ORDER_STATUSES.forEach((s) => (c[s] = 0));
    orders.forEach((o) => {
      if (o.isTrashed) c.Trash++;
      else {
        c.All++;
        c[orderStatus(o)]++;
      }
    });
    return c;
  }, [orders]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const termDigits = digitsOnly(term);
    const list = orders.filter((o) => {
      if (tab === 'Trash' ? !o.isTrashed : o.isTrashed) return false;
      if (tab !== 'All' && tab !== 'Trash' && orderStatus(o) !== tab) return false;
      if (!inRange(tsToDate(o.createdAt), range)) return false;
      if (!term) return true;
      const id = displayOrderId(o);
      if (/^#?\d+$/.test(term)) {
        // pure number: order no. exact, or mobile contains
        return digitsOnly(id) === termDigits || digitsOnly(o.mobile).includes(termDigits);
      }
      const hay = [id, o.firmName, o.city, o.mobile, o.agentName, o.gstNo, ...getOrderLines(o).map((l) => l.designNumber)].join(' ').toLowerCase();
      return hay.includes(term);
    });
    // open orders first, then newest
    const rank = (o: Order) => (['Completed', 'Cancelled'].includes(orderStatus(o)) ? 1 : 0);
    return list.sort((a, b) => rank(a) - rank(b));
  }, [orders, tab, q, range]);

  const allSel = shown.length > 0 && shown.every((o) => sel.includes(o.id));

  const bulk = async (fn: (id: string, b: ReturnType<typeof writeBatch>) => void) => {
    const b = writeBatch(db);
    sel.forEach((id) => fn(id, b));
    await b.commit();
    setSel([]);
  };

  const openGallery = (o: Order) => {
    const imgs: string[] = [];
    getOrderLines(o).forEach((l) => {
      const s = samples.find((x) => x.id === l.sampleId) || samples.find((x) => String(x.designNumber) === l.designNumber);
      if (s) imgs.push(...allSamplePhotos(s));
      else {
        if (l.image) imgs.push(l.image);
        imgs.push(...Object.values(l.colorPhotos));
      }
    });
    const uniq = Array.from(new Set(imgs.filter(Boolean)));
    if (!uniq.length) return alert('No photos found for this order.');
    setGallery({ images: uniq, index: 0 });
  };

  const exportCsv = () => {
    const rows = [['Order No', 'Date', 'Status', 'Sales Person', 'Category', 'Firm', 'Mobile', 'City', 'GSTIN', 'Agent', 'Design', 'Colour', 'Qty', 'Rate', 'Amount', 'Sample Added By', 'Remarks']];
    shown.forEach((o) =>
      getOrderLines(o).forEach((l) =>
        Object.entries(l.items).forEach(([c, qn]) =>
          rows.push([
            displayOrderId(o), formatDate(tsToDate(o.createdAt)), orderStatus(o), orderSeller(o).name, categoryName(l.category || orderCategory(o)),
            o.firmName, o.mobile, o.city, o.gstNo || '', o.agentName || '',
            l.designNumber, c, String(qn), String(l.price), String(qn * l.price), o.sampleCreatorName || '', o.remarks || '',
          ]),
        ),
      ),
    );
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `gfive-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const TABS: Tab[] = ['All', ...ORDER_STATUSES, 'Trash'];

  return (
    <>
      <PageHeader
        eyebrow="Live"
        title="Orders"
        subtitle={isSuper ? 'All staff orders. Use the filters to see one salesperson.' : 'Only orders from the links you shared are shown here.'}
        actions={
          <button className="btn btn-outline" onClick={exportCsv} disabled={!shown.length}>
            <Download size={16} /> Export CSV
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.12em] text-muted">{label}</span>
              <Icon size={17} className={tone} />
            </div>
            <p className={`mt-2 font-display text-[28px] font-semibold leading-none ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* toolbar */}
      <div className="card mt-6 p-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order no. (e.g. 22), firm, design, city or mobile" />
          </div>
          {isSuper && (
            <div className="relative">
              <select value={staffFilter} onChange={(e) => { setStaffFilter(e.target.value); setSel([]); }} className="input appearance-none pr-9 md:w-48" aria-label="Salesperson">
                <option value="">All salespeople</option>
                {staffList.map((s) => (
                  <option key={s.uid} value={s.uid}>{s.name}</option>
                ))}
                <option value="unassigned">Unassigned (old orders)</option>
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
            </div>
          )}
          <div className="relative">
            <select value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setSel([]); }} className="input appearance-none pr-9 md:w-44" aria-label="Category">
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
          </div>
          <div className="relative">
            <select value={range} onChange={(e) => setRange(e.target.value as Range)} className="input appearance-none pr-9 md:w-44">
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="month">This month</option>
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSel([]); }}
              className={`chip shrink-0 ${tab === t ? (t === 'Trash' ? '!border-red-700 !bg-red-700 !text-white' : 'chip-active') : ''}`}
            >
              {t !== 'All' && t !== 'Trash' && <span className={`size-2 rounded-full ${STATUS_STYLE[t].dot}`} />}
              {t === 'Trash' && <Trash2 size={13} />}
              {t} <span className="opacity-60">{counts[t] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {shown.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-leaf-700" checked={allSel} onChange={() => setSel(allSel ? [] : shown.map((o) => o.id))} />
            Select all ({shown.length})
          </label>
          {sel.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-leaf-800">{sel.length} selected</span>
              {tab === 'Trash' ? (
                <>
                  <button className="btn btn-sm btn-outline" onClick={() => bulk((id, b) => b.update(doc(db, 'orders', id), { isTrashed: false }))}>
                    <RotateCcw size={14} /> Restore
                  </button>
                  {isSuper && (
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => confirm(`Permanently delete ${sel.length} order(s)?`) && bulk((id, b) => b.delete(doc(db, 'orders', id)))}
                    >
                      Delete forever
                    </button>
                  )}
                </>
              ) : (
                <>
                  <select
                    className="h-9 rounded-full border border-line bg-white px-3 text-sm"
                    defaultValue=""
                    onChange={(e) => {
                      const v = e.target.value as OrderStatus;
                      if (v) bulk((id, b) => b.update(doc(db, 'orders', id), { status: v }));
                      e.target.value = '';
                    }}
                  >
                    <option value="" disabled>Set status…</option>
                    {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button className="btn btn-sm btn-outline !text-red-700" onClick={() => confirm(`Move ${sel.length} order(s) to trash?`) && bulk((id, b) => b.update(doc(db, 'orders', id), { isTrashed: true }))}>
                    <Trash2 size={14} /> Trash
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* list */}
      <div className="mt-4 space-y-4">
        {loading ? (
          <div className="grid place-items-center py-24"><Loader2 className="animate-spin text-leaf-700" /></div>
        ) : error ? (
          <div className="card p-10 text-center text-red-700">{error}</div>
        ) : shown.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="font-display text-2xl">No orders here</p>
            <p className="mt-1 text-sm text-muted">{q || range !== 'all' ? 'Try clearing the search or date filter.' : 'Share sample links on WhatsApp to start getting orders.'}</p>
          </div>
        ) : (
          shown.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              selected={sel.includes(o.id)}
              canDelete={isSuper}
              staffList={isSuper ? staffList : null}
              onSelect={() => setSel((p) => (p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id]))}
              onInvoice={() => setInvoice(o)}
              onPhotos={() => openGallery(o)}
            />
          ))
        )}
      </div>

      {invoice && <InvoiceModal order={invoice} settings={settings} onClose={() => setInvoice(null)} />}
      {gallery && (
        <Lightbox images={gallery.images} index={gallery.index} onIndexChange={(i) => setGallery((g) => (g ? { ...g, index: i } : g))} onClose={() => setGallery(null)} />
      )}
    </>
  );
}

function OrderCard({
  order: o, selected, canDelete, staffList, onSelect, onInvoice, onPhotos,
}: {
  order: Order;
  selected: boolean;
  canDelete: boolean;
  staffList: PublicStaff[] | null; // Super Admin only: can correct the salesperson
  onSelect: () => void;
  onInvoice: () => void;
  onPhotos: () => void;
}) {
  const st = orderStatus(o);
  const phone = digitsOnly(o.mobile);
  const waPhone = phone.length === 10 ? `91${phone}` : phone;
  const style = STATUS_STYLE[st];
  const lines = getOrderLines(o);
  const date = tsToDate(o.createdAt);
  const done = st === 'Completed' || st === 'Cancelled';

  return (
    <article className={`card overflow-hidden transition ${selected ? 'ring-2 ring-leaf-600' : ''} ${done && !o.isTrashed ? 'opacity-75' : ''} ${o.isTrashed ? 'bg-red-50/40' : ''}`}>
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-3">
          <input type="checkbox" className="size-4 accent-leaf-700" checked={selected} onChange={onSelect} aria-label="Select order" />
          <span className="font-display text-xl font-semibold text-leaf-800">{displayOrderId(o)}</span>
          <span className="text-xs text-muted">{date ? formatDate(date, true) : 'Just now'}</span>
          {categoryName(orderCategory(o)) && (
            <span className="rounded-full bg-gold-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-600 ring-1 ring-gold-100">{categoryName(orderCategory(o))}</span>
          )}
        </div>
        {o.isTrashed ? (
          <div className="flex gap-2">
            <button className="btn btn-sm btn-outline" onClick={() => updateDoc(doc(db, 'orders', o.id), { isTrashed: false })}>
              <RotateCcw size={14} /> Restore
            </button>
            {canDelete && (
              <button className="btn btn-sm btn-danger" onClick={async () => {
                if (!confirm(`Delete ${displayOrderId(o)} forever?`)) return;
                const b = writeBatch(db);
                b.delete(doc(db, 'orders', o.id));
                await b.commit();
              }}>
                Delete
              </button>
            )}
          </div>
        ) : (
          <label className={`relative inline-flex h-9 items-center gap-2 rounded-full border pl-3 pr-8 text-sm font-medium ${style.pill}`}>
            <span className={`size-2 rounded-full ${style.dot}`} />
            {st}
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5" />
            <select
              value={st}
              onChange={(e) => updateDoc(doc(db, 'orders', o.id), { status: e.target.value })}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Change status"
            >
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[240px_1fr]">
        {/* customer */}
        <div>
          <p className="text-[17px] font-semibold leading-tight">{o.firmName}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><MapPin size={13} /> {o.city}</p>
          <div className="mt-2 flex gap-2">
            <a href={`tel:${o.mobile}`} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-xs text-leaf-800 hover:bg-leaf-50">
              <Phone size={13} /> {o.mobile}
            </a>
            <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer" className="grid size-8 place-items-center rounded-full bg-[#25d366] text-white" aria-label="Chat with customer on WhatsApp" title="Chat with customer">
              <MessageCircle size={14} />
            </a>
          </div>
          <div className="mt-2 space-y-0.5 text-xs text-muted">
            {o.gstNo && <p>GSTIN: <span className="text-ink">{o.gstNo}</span></p>}
            {o.agentName && <p>Agent: <span className="text-ink">{o.agentName}</span></p>}
            {staffList ? (
              <SellerPicker order={o} staffList={staffList} />
            ) : (
              <p>Salesperson: <span className="text-ink">{orderSeller(o).name}</span></p>
            )}
            {o.sampleCreatorName && <p>Sample added by: <span className="text-ink">{o.sampleCreatorName}</span></p>}
          </div>
          {o.remarks && <p className="mt-2 rounded-lg bg-gold-50 px-2.5 py-1.5 text-xs text-gold-600">“{o.remarks}”</p>}
        </div>

        {/* lines */}
        <div className="space-y-2.5">
          {lines.map((l, i) => (
            <div key={l.designNumber + i} className="flex gap-3 rounded-xl bg-sand/50 p-2.5">
              <button onClick={onPhotos} className="h-16 w-13 shrink-0 overflow-hidden rounded-lg bg-sand" aria-label="View photos">
                {l.image && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={cldThumb(l.image, 104, 128)} alt="" className="size-full object-cover" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-semibold">#{l.designNumber} <span className="text-xs font-normal text-muted">@ {inr(l.price)}/pc</span></p>
                  <p className="text-sm font-semibold text-leaf-700">{l.totalQuantity} pcs · {inr(l.totalAmount)}</p>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {Object.entries(l.items).map(([c, qn]) => (
                    <span key={c} className="inline-flex items-center gap-1 rounded-full border border-line bg-white py-0.5 pl-0.5 pr-2 text-xs">
                      {l.colorPhotos[c] ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={cldThumb(l.colorPhotos[c], 40, 40)} alt="" className="size-5 rounded-full object-cover" />
                      ) : (
                        <span className="ml-1 size-2 rounded-full bg-gold-400" />
                      )}
                      {c}: <b>{qn}</b>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-sand/30 px-4 py-3">
        <p className="text-sm">
          <span className="text-muted">Total </span>
          <span className="font-semibold">{o.totalQuantity} pcs</span>
          <span className="mx-1.5 text-line">|</span>
          <span className="font-display text-xl font-semibold text-leaf-700">{inr(o.totalAmount)}</span>
        </p>
        <div className="flex gap-2">
          {!o.isTrashed && (
            <button className="btn btn-sm btn-ghost !text-red-700" onClick={() => updateDoc(doc(db, 'orders', o.id), { isTrashed: true })} aria-label="Move to trash">
              <Trash2 size={15} />
            </button>
          )}
          <button className="btn btn-sm btn-outline" onClick={onPhotos}>
            <Images size={15} /> Photos
          </button>
          <button className="btn btn-sm btn-primary" onClick={onInvoice}>
            <FileText size={15} /> Invoice
          </button>
        </div>
      </div>
    </article>
  );
}

/** Super Admin: who gets credit for this order (fixes old/unassigned orders). */
function SellerPicker({ order: o, staffList }: { order: Order; staffList: PublicStaff[] }) {
  const s = orderSeller(o);
  return (
    <label className="flex items-center gap-1.5">
      <span>Salesperson:</span>
      <select
        value={s.uid}
        onChange={async (e) => {
          const p = staffList.find((x) => x.uid === e.target.value);
          if (!confirm(p ? `Credit ${displayOrderId(o)} to ${p.name}?` : `Mark ${displayOrderId(o)} as unassigned?`)) return;
          await updateDoc(doc(db, 'orders', o.id), {
            salesPersonUid: p?.uid || '',
            salesPersonName: p?.name || '',
            salesPerson: p?.name || 'N/A',
          });
        }}
        className={`h-7 max-w-40 rounded-full border px-2 text-xs ${s.uid ? 'border-line bg-white text-ink' : 'border-amber-300 bg-amber-50 text-amber-800'}`}
      >
        <option value="">{s.uid ? 'Unassigned' : `Unassigned${s.name !== 'Unassigned' ? ` (${s.name})` : ''}`}</option>
        {staffList.map((p) => (
          <option key={p.uid} value={p.uid}>{p.name}</option>
        ))}
      </select>
    </label>
  );
}
