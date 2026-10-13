/**
 * Turns raw orders + samples into exact sales numbers. All arithmetic happens
 * here (never in the AI) so the figures shown to staff are always correct.
 */
import type { Order, Sample } from './types';
import { getOrderLines, orderStatus, displayOrderId } from './orders';
import { tsToDate } from './format';
import { collectionName } from './collections';

type Range = { key: string; label: string; from: Date; to: Date };

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function ranges(now = new Date()): Range[] {
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + 864e5);
  const yesterday = new Date(today.getTime() - 864e5);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return [
    { key: 'today', label: 'Today', from: today, to: tomorrow },
    { key: 'yesterday', label: 'Yesterday', from: yesterday, to: today },
    { key: 'last7', label: 'Last 7 days', from: new Date(today.getTime() - 6 * 864e5), to: tomorrow },
    { key: 'thisMonth', label: 'This month', from: monthStart, to: tomorrow },
    { key: 'lastMonth', label: 'Last month', from: lastMonthStart, to: monthStart },
    { key: 'last90', label: 'Last 90 days', from: new Date(today.getTime() - 89 * 864e5), to: tomorrow },
    { key: 'allTime', label: 'All time', from: new Date(2000, 0, 1), to: tomorrow },
  ];
}

const norm = (s?: string) => (s || '').trim() || 'Unassigned';
const custKey = (o: Order) => (o.mobile || '').replace(/\D/g, '').slice(-10) || (o.firmName || '').trim().toLowerCase();

interface Agg {
  orders: number;
  pcs: number;
  amount: number;
  customers: Set<string>;
}
const agg = (): Agg => ({ orders: 0, pcs: 0, amount: 0, customers: new Set() });
const out = (a: Agg) => ({ orders: a.orders, pcs: a.pcs, amount: Math.round(a.amount), customers: a.customers.size });

function top<T>(m: Map<string, T>, by: (v: T) => number, n: number) {
  return Array.from(m.entries())
    .sort((a, b) => by(b[1]) - by(a[1]))
    .slice(0, n);
}

/** Exact sales stats for one period. Cancelled & trashed orders are excluded. */
export function periodStats(orders: Order[], samples: Sample[], r: Range) {
  const inR = orders.filter((o) => {
    if (o.isTrashed || orderStatus(o) === 'Cancelled') return false;
    const d = tsToDate(o.createdAt) || new Date(); // brand-new orders have no server time yet
    return d >= r.from && d < r.to;
  });
  const total = agg();
  const designs = new Map<string, Agg & { designNumber: string; colours: Map<string, number>; collection?: string }>();
  const people = new Map<string, Agg & { designs: Map<string, number>; cities: Map<string, number>; lines: number }>();
  const cities = new Map<string, Agg>();
  const colls = new Map<string, Agg>();
  const colours = new Map<string, number>();
  const sampleById = new Map(samples.map((s) => [s.id, s]));

  inR.forEach((o) => {
    const ck = custKey(o);
    total.orders++;
    total.pcs += Number(o.totalQuantity || 0);
    total.amount += Number(o.totalAmount || 0);
    total.customers.add(ck);
    const city = (o.city || '').trim() || 'Unknown';
    const c = cities.get(city) || agg();
    c.orders++;
    c.pcs += Number(o.totalQuantity || 0);
    c.amount += Number(o.totalAmount || 0);
    c.customers.add(ck);
    cities.set(city, c);

    const seenPeople = new Set<string>();
    getOrderLines(o).forEach((l) => {
      const s = sampleById.get(l.sampleId) || samples.find((x) => String(x.designNumber) === l.designNumber);
      const key = s?.id || `#${l.designNumber}`;
      const d = designs.get(key) || { ...agg(), designNumber: l.designNumber, colours: new Map(), collection: s?.collection };
      d.orders++;
      d.pcs += l.totalQuantity;
      d.amount += l.totalAmount;
      d.customers.add(ck);
      Object.entries(l.items).forEach(([col, q]) => {
        d.colours.set(col, (d.colours.get(col) || 0) + q);
        const cn = col.trim().toLowerCase();
        colours.set(cn, (colours.get(cn) || 0) + q);
      });
      designs.set(key, d);

      const cname = collectionName(s?.collection) || 'No collection';
      const cl = colls.get(cname) || agg();
      cl.pcs += l.totalQuantity;
      cl.amount += l.totalAmount;
      cl.customers.add(ck);
      colls.set(cname, cl);

      const sp = norm(l.salesPerson || s?.salesPerson);
      const p = people.get(sp) || { ...agg(), designs: new Map(), cities: new Map(), lines: 0 };
      if (!seenPeople.has(sp)) {
        p.orders++;
        seenPeople.add(sp);
        p.cities.set(city, (p.cities.get(city) || 0) + 1);
      }
      p.lines++;
      p.pcs += l.totalQuantity;
      p.amount += l.totalAmount;
      p.customers.add(ck);
      p.designs.set(l.designNumber, (p.designs.get(l.designNumber) || 0) + l.totalQuantity);
      people.set(sp, p);
    });
  });

  return {
    period: r.label,
    from: r.from.toISOString().slice(0, 10),
    to: new Date(r.to.getTime() - 1).toISOString().slice(0, 10),
    ...out(total),
    avgOrderValue: total.orders ? Math.round(total.amount / total.orders) : 0,
    topDesigns: top(designs, (v) => v.pcs, 10).map(([, v]) => ({
      design: v.designNumber,
      collection: collectionName(v.collection) || null,
      ...out(v),
      topColours: top(v.colours, (x) => x, 3).map(([k, q]) => `${k} ${q}`),
    })),
    salesPeople: top(people, (v) => v.amount, 10).map(([name, v]) => ({
      name,
      ...out(v),
      avgOrderValue: v.orders ? Math.round(v.amount / v.orders) : 0,
      avgPcsPerOrder: v.orders ? +(v.pcs / v.orders).toFixed(1) : 0,
      topDesigns: top(v.designs, (x) => x, 3).map(([k, q]) => `#${k} ${q}pcs`),
      topCities: top(v.cities, (x) => x, 3).map(([k, q]) => `${k} (${q})`),
    })),
    topCities: top(cities, (v) => v.amount, 6).map(([k, v]) => ({ city: k, ...out(v) })),
    collections: top(colls, (v) => v.amount, 6).map(([k, v]) => ({ collection: k, pcs: v.pcs, amount: Math.round(v.amount) })),
    topColours: top(colours, (x) => x, 6).map(([k, q]) => `${k} ${q}pcs`),
  };
}

/** Everything the admin assistant is allowed to see, as compact JSON. */
export function buildDigest(orders: Order[], samples: Sample[], now = new Date()) {
  const R = ranges(now);
  const live = orders.filter((o) => !o.isTrashed);

  // repeat vs new customers (all time)
  const firstSeen = new Map<string, Date>();
  [...live]
    .filter((o) => orderStatus(o) !== 'Cancelled')
    .sort((a, b) => (tsToDate(a.createdAt)?.getTime() || 0) - (tsToDate(b.createdAt)?.getTime() || 0))
    .forEach((o) => {
      const k = custKey(o);
      if (!firstSeen.has(k)) firstSeen.set(k, tsToDate(o.createdAt) || now);
    });

  const status: Record<string, number> = { Pending: 0, Dispatched: 0, Completed: 0, Cancelled: 0 };
  live.forEach((o) => status[orderStatus(o)]++);
  const stalePending = live
    .filter((o) => orderStatus(o) === 'Pending')
    .map((o) => ({ o, d: tsToDate(o.createdAt) || now }))
    .filter(({ d }) => now.getTime() - d.getTime() > 3 * 864e5)
    .sort((a, b) => a.d.getTime() - b.d.getTime())
    .slice(0, 15)
    .map(({ o, d }) => ({ order: displayOrderId(o), firm: o.firmName, city: o.city, pcs: o.totalQuantity, amount: o.totalAmount, daysOld: Math.floor((now.getTime() - d.getTime()) / 864e5) }));

  const todayR = R[0];
  const todays = live
    .filter((o) => {
      const d = tsToDate(o.createdAt) || now;
      return d >= todayR.from && d < todayR.to;
    })
    .map((o) => ({
      order: displayOrderId(o),
      time: (tsToDate(o.createdAt) || now).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      firm: o.firmName,
      city: o.city,
      status: orderStatus(o),
      pcs: o.totalQuantity,
      amount: o.totalAmount,
      designs: getOrderLines(o).map((l) => `#${l.designNumber}`).join(', '),
      salesPerson: Array.from(new Set(getOrderLines(o).map((l) => norm(l.salesPerson)))).join(', '),
      newCustomer: (firstSeen.get(custKey(o))?.getTime() || 0) >= todayR.from.getTime(),
    }));

  // designs uploaded per sales person (sharing activity)
  const uploads = new Map<string, { total: number; last30: number }>();
  samples
    .filter((s) => !s.isTrashed)
    .forEach((s) => {
      const k = norm(s.salesPerson);
      const u = uploads.get(k) || { total: 0, last30: 0 };
      u.total++;
      const d = tsToDate(s.createdAt);
      if (d && now.getTime() - d.getTime() <= 30 * 864e5) u.last30++;
      uploads.set(k, u);
    });

  // designs that are live but never ordered
  const ordered = new Set<string>();
  live.forEach((o) => getOrderLines(o).forEach((l) => ordered.add(l.sampleId || `#${l.designNumber}`)));
  const neverOrdered = samples.filter((s) => !s.isTrashed && !ordered.has(s.id)).map((s) => `#${s.designNumber}`).slice(0, 20);

  const newCustomersThisMonth = Array.from(firstSeen.values()).filter((d) => d >= R[3].from).length;

  return {
    generatedAt: now.toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' }),
    notes: [
      'Amounts are in INR. Cancelled and trashed orders are excluded from sales figures.',
      'A sales person is credited for a design when the design sample was uploaded under their name (their shared link brought the order).',
      'customers = unique buyers by mobile number.',
    ],
    statusCounts: status,
    todayOrders: todays,
    periods: Object.fromEntries(R.map((r) => [r.key, periodStats(orders, samples, r)])),
    designsUploadedBySalesPerson: Object.fromEntries(uploads),
    customers: { totalUnique: firstSeen.size, newThisMonth: newCustomersThisMonth },
    pendingOver3Days: stalePending,
    liveDesigns: samples.filter((s) => !s.isTrashed).length,
    liveDesignsNeverOrdered: neverOrdered,
  };
}

export type Digest = ReturnType<typeof buildDigest>;
