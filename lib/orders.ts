import type { Order, OrderLine, OrderStatus } from './types';
import { inr } from './format';
import { categoryName } from './categories';

export const ORDER_STATUSES: OrderStatus[] = ['Pending', 'Dispatched', 'Completed', 'Cancelled'];

export const STATUS_STYLE: Record<OrderStatus, { label: string; dot: string; pill: string }> = {
  Pending: { label: 'Pending', dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-800 border-amber-200' },
  Dispatched: { label: 'Dispatched', dot: 'bg-sky-600', pill: 'bg-sky-50 text-sky-800 border-sky-200' },
  Completed: { label: 'Completed', dot: 'bg-leaf-600', pill: 'bg-leaf-50 text-leaf-800 border-leaf-100' },
  Cancelled: { label: 'Cancelled', dot: 'bg-red-600', pill: 'bg-red-50 text-red-800 border-red-200' },
};

export function orderStatus(o: Pick<Order, 'status'>): OrderStatus {
  return (o.status as OrderStatus) || 'Pending';
}

export function displayOrderId(o: Pick<Order, 'orderId' | 'id'>): string {
  return o.orderId || `GFive#${o.id.substring(0, 5)}`;
}

/**
 * Old orders stored `colorPhotos` with the main design photo as a fallback for
 * every colour. If every colour points at the same photo, it is not really a
 * colour photo — treat it as "no colour photos" so we don't show the same
 * picture next to Red, Pink and Blue.
 */
function cleanColorPhotos(photos: Record<string, string> | undefined, mainImage?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!photos) return out;
  const values = Object.values(photos).filter(Boolean);
  const allSame = values.length > 1 && values.every((v) => v === values[0]);
  Object.entries(photos).forEach(([k, v]) => {
    if (!v) return;
    if (allSame) return;
    if (mainImage && v === mainImage) return;
    out[k] = v;
  });
  return out;
}

/** Returns the designs inside an order — works for both cart orders and old single-design orders. */
export function getOrderLines(o: Order): OrderLine[] {
  if (Array.isArray(o.lines) && o.lines.length > 0) {
    return o.lines.map((l) => ({ ...l, colorPhotos: cleanColorPhotos(l.colorPhotos, l.image) }));
  }
  const items: Record<string, number> = {};
  Object.entries(o.items || {}).forEach(([k, v]) => {
    const q = Number(v || 0);
    if (q > 0) items[k] = q;
  });
  const photos = o.colorPhotos || {};
  const values = Object.values(photos).filter(Boolean);
  const guessedMain = values.length > 1 && values.every((v) => v === values[0]) ? values[0] : values[0] || '';
  const totalQuantity = Object.values(items).reduce((a, b) => a + b, 0);
  return [
    {
      sampleId: o.sampleId || '',
      designNumber: String(o.designNumber || ''),
      price: Number(o.price || 0),
      salesPerson: o.salesPersonName || o.salesPerson,
      category: o.category,
      image: guessedMain,
      items,
      colorPhotos: cleanColorPhotos(photos),
      totalQuantity: totalQuantity || Number(o.totalQuantity || 0),
      totalAmount: Number(o.totalAmount || totalQuantity * Number(o.price || 0)),
    },
  ];
}

/**
 * The ONE salesperson credited for an order (used for dashboards & salary).
 * New orders: salesPersonUid from the shared link. Old orders: name only (uid '').
 */
export function orderSeller(o: Order): { uid: string; name: string } {
  const uid = o.salesPersonUid || '';
  const raw = (o.salesPersonName || o.salesPerson || '').trim();
  const name = raw && raw !== 'N/A' ? raw : '';
  return { uid, name: name || (uid ? 'Sales Person' : 'Unassigned') };
}

/** Category of an order (first design's category). */
export function orderCategory(o: Order): string {
  return o.category || getOrderLines(o).find((l) => l.category)?.category || '';
}

/** Atomic counter -> "GFive#23". Same counter document as before, so numbering continues. */
export interface CustomerDetails {
  firmName: string;
  mobile: string;
  city: string;
  gstNo: string;
  agentName: string;
  remarks: string;
}

/**
 * WhatsApp order message. `link` = the design page (with the salesperson's ref);
 * WhatsApp shows the design photo as a preview of that link.
 */
export function buildOrderWhatsAppText(orderNo: string, lines: OrderLine[], c: CustomerDetails, link = ''): string {
  const totalQty = lines.reduce((a, l) => a + l.totalQuantity, 0);
  const totalAmt = lines.reduce((a, l) => a + l.totalAmount, 0);
  const first = lines[0];
  // Same layout as the original GFive WhatsApp order message
  let t = `*-----------GFive KOLKATA-----------*\n`;
  t += `*NEW UNSTITCHED SUIT SAMPLE*\n\n`;
  const cats = Array.from(new Set(lines.map((l) => categoryName(l.category)).filter(Boolean)));
  if (cats.length) t += `*✦ DESIGN CATEGORY: ${cats.join(', ').toUpperCase()} ✦*\n\n`;
  t += `*Order No:* ${orderNo}\n`;
  t += `*Design No:* ${lines.map((l) => l.designNumber).join(', ')}\n`;
  if (lines.length === 1) {
    t += `*Price:* ${inr(first.price)}/pc\n`;
    if (first.fabric) t += `*Fabric:* ${first.fabric}\n`;
    if (first.work) t += `*Work:* ${first.work}\n`;
  }
  const sp = Array.from(new Set(lines.map((l) => l.salesPerson).filter(Boolean))).join(', ');
  if (sp) t += `*Sales Person:* ${sp}\n`;
  t += `\n*CUSTOMER DETAILS:*\n`;
  t += `• *Firm:* ${c.firmName}\n• *Mobile:* ${c.mobile}\n• *City:* ${c.city}\n`;
  if (c.gstNo) t += `• *GST No:* ${c.gstNo}\n`;
  if (c.agentName) t += `• *Agent:* ${c.agentName}\n`;
  if (c.remarks) t += `• *Remarks:* ${c.remarks}\n`;
  t += `\n*COLOUR        QUANTITIES:*\n`;
  t += `--------------------------\n`;
  lines.forEach((l) => {
    if (lines.length > 1) t += `*Design ${l.designNumber}* (${inr(l.price)}/pc)\n`;
    Object.entries(l.items).forEach(([color, qty]) => {
      if (qty > 0) t += `• *${color}* -----------> *${qty} pcs*\n`;
    });
  });
  t += `-------------------------------\n`;
  t += `*TOTAL:* ${totalQty} pcs\n`;
  t += `*TOTAL AMOUNT:* ${inr(totalAmt)}\n`;
  t += `-------------------------------`;
  if (link) t += `\n\n👇 *Design photo & details:*\n${link}`;
  return t;
}
