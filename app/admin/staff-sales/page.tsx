'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, Loader2, Users } from 'lucide-react';
import { useOrders } from '@/lib/hooks';
import { useStaffList } from '@/lib/staff';
import { useAuth } from '@/lib/auth';
import { displayOrderId, orderCategory, orderSeller, orderStatus, ORDER_STATUSES, STATUS_STYLE } from '@/lib/orders';
import { CATEGORIES, categoryName, normCategory } from '@/lib/categories';
import { formatDate, inr, tsToDate } from '@/lib/format';
import type { Order, OrderStatus } from '@/lib/types';
import PageHeader from '@/components/admin/PageHeader';

type Period = 'thisMonth' | 'lastMonth' | 'month' | 'all';

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface Row {
  key: string; // uid or 'unassigned'
  name: string;
  orders: Order[];
  count: number; // orders excluding cancelled
  pcs: number;
  value: number; // excluding cancelled
  byStatus: Record<OrderStatus, { n: number; value: number }>;
}

const emptyStatus = () => Object.fromEntries(ORDER_STATUSES.map((s) => [s, { n: 0, value: 0 }])) as Row['byStatus'];

export default function StaffSalesPage() {
  const { isSuper } = useAuth();
  const { orders, loading } = useOrders();
  const staff = useStaffList(isSuper);
  const now = new Date();
  const [period, setPeriod] = useState<Period>('thisMonth');
  const [month, setMonth] = useState(monthKey(now));
  const [cat, setCat] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const label =
    period === 'thisMonth'
      ? now.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
      : period === 'lastMonth'
        ? new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
        : period === 'month'
          ? new Date(`${month}-01T00:00:00`).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
          : 'All time';

  const inPeriod = (o: Order) => {
    if (period === 'all') return true;
    const d = tsToDate(o.createdAt) || now;
    const key =
      period === 'thisMonth' ? monthKey(now) : period === 'lastMonth' ? monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)) : month;
    return monthKey(d) === key;
  };

  const rows = useMemo(() => {
    const map = new Map<string, Row>();
    const ensure = (key: string, name: string) => {
      if (!map.has(key)) map.set(key, { key, name, orders: [], count: 0, pcs: 0, value: 0, byStatus: emptyStatus() });
      return map.get(key)!;
    };
    // every staff member gets a row, even with zero sales
    staff.forEach((s) => ensure(s.uid, s.name));
    orders
      .filter((o) => !o.isTrashed && inPeriod(o) && (!cat || normCategory(orderCategory(o)) === cat))
      .forEach((o) => {
        const s = orderSeller(o);
        const r = ensure(s.uid || 'unassigned', s.uid ? staff.find((x) => x.uid === s.uid)?.name || s.name : 'Unassigned (old orders)');
        const st = orderStatus(o);
        const amt = Number(o.totalAmount || 0);
        r.orders.push(o);
        r.byStatus[st].n++;
        r.byStatus[st].value += amt;
        if (st !== 'Cancelled') {
          r.count++;
          r.pcs += Number(o.totalQuantity || 0);
          r.value += amt;
        }
      });
    return Array.from(map.values()).sort((a, b) => (a.key === 'unassigned' ? 1 : b.key === 'unassigned' ? -1 : b.value - a.value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, staff, period, month, cat]);

  const total = rows.reduce(
    (t, r) => ({
      count: t.count + r.count,
      pcs: t.pcs + r.pcs,
      value: t.value + r.value,
      completed: t.completed + r.byStatus.Completed.value,
    }),
    { count: 0, pcs: 0, value: 0, completed: 0 },
  );

  const exportCsv = () => {
    const out: string[][] = [
      [`GFive — Sales Person-wise sales — ${label}${cat ? ` — ${categoryName(cat)}` : ''}`],
      [],
      ['Sales Person', 'Orders (excl. cancelled)', 'Pieces', 'Sales value', 'Pending value', 'Dispatched value', 'Completed value', 'Cancelled orders'],
      ...rows.map((r) => [
        r.name, String(r.count), String(r.pcs), String(r.value),
        String(r.byStatus.Pending.value), String(r.byStatus.Dispatched.value), String(r.byStatus.Completed.value), String(r.byStatus.Cancelled.n),
      ]),
      ['TOTAL', String(total.count), String(total.pcs), String(total.value), '', '', String(total.completed), ''],
      [],
      ['Order No', 'Date', 'Sales Person', 'Status', 'Category', 'Firm', 'City', 'Pieces', 'Amount', 'Sample added by'],
      ...rows.flatMap((r) =>
        r.orders.map((o) => [
          displayOrderId(o), formatDate(tsToDate(o.createdAt)), r.name, orderStatus(o), categoryName(orderCategory(o)),
          o.firmName, o.city, String(o.totalQuantity), String(o.totalAmount), o.sampleCreatorName || '',
        ]),
      ),
    ];
    const csv = out.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `gfive-sales-person-sales-${period === 'all' ? 'all-time' : period === 'month' ? month : label.replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        eyebrow="Super Admin"
        title="Sales Person-wise orders & sales"
        subtitle="Every order is credited to exactly one Sales Person — the person whose link the customer ordered from."
        actions={
          <button className="btn btn-outline" onClick={exportCsv} disabled={loading}>
            <Download size={16} /> Export for salary
          </button>
        }
      />

      <div className="card mb-5 flex flex-col gap-3 p-3 md:flex-row md:items-center">
        <div className="flex flex-wrap gap-2">
          {([
            ['thisMonth', 'This month'],
            ['lastMonth', 'Last month'],
            ['month', 'Pick month'],
            ['all', 'All time'],
          ] as [Period, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setPeriod(k)} className={`chip h-10 px-4 ${period === k ? 'chip-active' : ''}`}>
              {l}
            </button>
          ))}
          {period === 'month' && <input type="month" className="input h-10 w-44" value={month} max={monthKey(now)} onChange={(e) => setMonth(e.target.value)} />}
        </div>
        <div className="relative md:ml-auto">
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="input appearance-none pr-9 md:w-48" aria-label="Category">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Period', label],
          ['Orders', String(total.count)],
          ['Sales value', inr(total.value)],
          ['Completed value', inr(total.completed)],
        ].map(([k, v]) => (
          <div key={k} className="card p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{k}</p>
            <p className="mt-1.5 truncate font-display text-2xl font-semibold text-leaf-800">{v}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-24"><Loader2 className="animate-spin text-leaf-700" /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line bg-sand/50 text-left text-[11px] uppercase tracking-[0.1em] text-muted">
                <th className="p-3 font-medium">Sales Person</th>
                <th className="p-3 text-right font-medium">Orders</th>
                <th className="p-3 text-right font-medium">Pieces</th>
                <th className="p-3 text-right font-medium">Sales value</th>
                <th className="p-3 text-right font-medium">Pending</th>
                <th className="p-3 text-right font-medium">Dispatched</th>
                <th className="p-3 text-right font-medium">Completed</th>
                <th className="p-3 text-right font-medium">Cancelled</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isOpen = open === r.key;
                return (
                  <Fragment key={r.key}>
                    <tr
                      onClick={() => setOpen(isOpen ? null : r.key)}
                      className={`cursor-pointer border-b border-line hover:bg-leaf-50/50 ${r.key === 'unassigned' ? 'text-muted' : ''}`}
                    >
                      <td className="p-3 font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          {r.key === 'unassigned' ? r.name : <><Users size={14} className="text-gold-600" /> {r.name}</>}
                        </span>
                      </td>
                      <td className="p-3 text-right">{r.count}</td>
                      <td className="p-3 text-right">{r.pcs}</td>
                      <td className="p-3 text-right font-semibold text-leaf-800">{inr(r.value)}</td>
                      <td className="p-3 text-right">{inr(r.byStatus.Pending.value)}<span className="block text-[11px] text-muted">{r.byStatus.Pending.n} order{r.byStatus.Pending.n === 1 ? '' : 's'}</span></td>
                      <td className="p-3 text-right">{inr(r.byStatus.Dispatched.value)}<span className="block text-[11px] text-muted">{r.byStatus.Dispatched.n} order{r.byStatus.Dispatched.n === 1 ? '' : 's'}</span></td>
                      <td className="p-3 text-right">{inr(r.byStatus.Completed.value)}<span className="block text-[11px] text-muted">{r.byStatus.Completed.n} order{r.byStatus.Completed.n === 1 ? '' : 's'}</span></td>
                      <td className="p-3 text-right text-muted">{r.byStatus.Cancelled.n}</td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-line bg-cream/60">
                        <td colSpan={8} className="p-3">
                          {r.orders.length === 0 ? (
                            <p className="px-2 py-3 text-muted">No orders in this period.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-muted">
                                  <th className="p-1.5 font-medium">Order</th>
                                  <th className="p-1.5 font-medium">Date</th>
                                  <th className="p-1.5 font-medium">Firm · City</th>
                                  <th className="p-1.5 font-medium">Category</th>
                                  <th className="p-1.5 font-medium">Status</th>
                                  <th className="p-1.5 text-right font-medium">Pcs</th>
                                  <th className="p-1.5 text-right font-medium">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.orders.map((o) => {
                                  const st = orderStatus(o);
                                  return (
                                    <tr key={o.id} className={`border-t border-line/70 ${st === 'Cancelled' ? 'text-muted line-through' : ''}`}>
                                      <td className="p-1.5 font-semibold text-leaf-800">{displayOrderId(o)}</td>
                                      <td className="p-1.5">{formatDate(tsToDate(o.createdAt))}</td>
                                      <td className="p-1.5">{o.firmName} · {o.city}</td>
                                      <td className="p-1.5">{categoryName(orderCategory(o)) || '—'}</td>
                                      <td className="p-1.5">
                                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 no-underline ${STATUS_STYLE[st].pill}`}>
                                          <span className={`size-1.5 rounded-full ${STATUS_STYLE[st].dot}`} />
                                          {st}
                                        </span>
                                      </td>
                                      <td className="p-1.5 text-right">{o.totalQuantity}</td>
                                      <td className="p-1.5 text-right font-semibold">{inr(o.totalAmount)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-leaf-800 font-semibold text-ivory">
                <td className="p-3">Total</td>
                <td className="p-3 text-right">{total.count}</td>
                <td className="p-3 text-right">{total.pcs}</td>
                <td className="p-3 text-right">{inr(total.value)}</td>
                <td className="p-3" colSpan={2} />
                <td className="p-3 text-right">{inr(total.completed)}</td>
                <td className="p-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">
        Sales value excludes cancelled and trashed orders. Old orders placed before Sales Person links existed appear under “Unassigned” — credit them to the right person from the Orders page.
      </p>
    </>
  );
}
