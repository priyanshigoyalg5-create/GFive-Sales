'use client';

/**
 * Sales-order PDF built with jsPDF drawing commands (real text, not a
 * screenshot). This fixes the old html2pdf problems:
 *  - page cut off on the right on phones (screenshot used the phone's width)
 *  - table rows/total splitting badly across pages
 *  - every colour showing the same main photo
 *  - ₹ symbol / blurry text
 */
import type { CompanySettings, Order, OrderLine } from './types';
import { amountInWords, tsToDate } from './format';
import { displayOrderId, getOrderLines, orderStatus } from './orders';

type JsPDF = import('jspdf').jsPDF;

const LEAF: [number, number, number] = [46, 90, 31];
const LEAF_DARK: [number, number, number] = [26, 53, 18];
const GOLD: [number, number, number] = [184, 137, 43];
const INK: [number, number, number] = [31, 42, 28];
const MUTED: [number, number, number] = [107, 111, 94];
const LINE: [number, number, number] = [226, 216, 196];
const SOFT: [number, number, number] = [251, 245, 233];

const rs = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---------------------------------------------------------------- assets
const cache = new Map<string, Promise<string | null>>();

function toJpegUrl(url: string, w: number, h: number): string {
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    return url.replace('/upload/', `/upload/w_${w},h_${h},c_fill,g_auto,q_80,f_jpg/`);
  }
  return url;
}

/** Fetches an image and returns a JPEG data URL (jsPDF only understands JPEG/PNG). */
function loadImage(url: string, w = 240, h = 300): Promise<string | null> {
  if (!url) return Promise.resolve(null);
  const key = `${url}|${w}x${h}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        try {
          const res = await fetch(toJpegUrl(url, w, h), { mode: 'cors' });
          if (!res.ok) return null;
          const blob = await res.blob();
          const bmp = await createImageBitmap(blob);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return null;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          // cover-fit
          const s = Math.max(w / bmp.width, h / bmp.height);
          const dw = bmp.width * s;
          const dh = bmp.height * s;
          ctx.drawImage(bmp, (w - dw) / 2, (h - dh) / 2, dw, dh);
          return canvas.toDataURL('image/jpeg', 0.85);
        } catch {
          return null;
        }
      })(),
    );
  }
  return cache.get(key)!;
}

async function loadFontBase64(path: string): Promise<string> {
  const res = await fetch(path);
  const buf = await res.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

let fontsPromise: Promise<[string, string]> | null = null;
function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = Promise.all([loadFontBase64('/fonts/Carlito-Regular.ttf'), loadFontBase64('/fonts/Carlito-Bold.ttf')]);
  }
  return fontsPromise;
}

async function logoDataUrl(): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch('/brand/logo-wordmark-white.jpg');
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const data = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.readAsDataURL(blob);
    });
    return { data, w: bmp.width, h: bmp.height };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- build
export async function buildInvoicePdf(order: Order, settings: CompanySettings): Promise<JsPDF> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableMod.default;

  const lines = getOrderLines(order);
  const [fonts, logo] = await Promise.all([loadFonts(), logoDataUrl()]);

  // Preload all images in parallel
  const designImgs = await Promise.all(lines.map((l) => loadImage(l.image || Object.values(l.colorPhotos)[0] || '', 240, 300)));
  const colorImgs: Record<string, string | null>[] = await Promise.all(
    lines.map(async (l) => {
      const out: Record<string, string | null> = {};
      await Promise.all(
        Object.keys(l.items).map(async (c) => {
          out[c] = l.colorPhotos[c] ? await loadImage(l.colorPhotos[c], 160, 160) : null;
        }),
      );
      return out;
    }),
  );

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  pdf.addFileToVFS('Carlito-Regular.ttf', fonts[0]);
  pdf.addFont('Carlito-Regular.ttf', 'Carlito', 'normal');
  pdf.addFileToVFS('Carlito-Bold.ttf', fonts[1]);
  pdf.addFont('Carlito-Bold.ttf', 'Carlito', 'bold');
  pdf.setFont('Carlito', 'normal');

  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 14;
  const orderNo = displayOrderId(order);
  const date = tsToDate(order.createdAt) || new Date();

  // ---- header band
  pdf.setFillColor(...LEAF_DARK);
  pdf.rect(0, 0, W, 4, 'F');
  pdf.setFillColor(...GOLD);
  pdf.rect(0, 4, W, 0.8, 'F');

  let y = 12;
  if (logo) {
    const lw = 46;
    const lh = (logo.h / logo.w) * lw;
    pdf.addImage(logo.data, 'JPEG', M - 1, y - 2, lw, lh);
    y += lh + 1;
  } else {
    pdf.setFont('Carlito', 'bold');
    pdf.setFontSize(24);
    pdf.setTextColor(...LEAF);
    pdf.text('GFive', M, y + 10);
    y += 16;
  }

  // company block (left, under logo)
  pdf.setTextColor(...INK);
  pdf.setFont('Carlito', 'bold');
  pdf.setFontSize(11);
  pdf.text(settings.companyName, M, y + 2);
  pdf.setFont('Carlito', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...MUTED);
  const companyLines = [
    settings.addressLine,
    [settings.email, settings.website].filter(Boolean).join('  |  '),
    settings.gstin ? `GSTIN: ${settings.gstin}` : '',
  ].filter(Boolean);
  companyLines.forEach((t, i) => pdf.text(t, M, y + 6.5 + i * 4.2));
  const leftBottom = y + 6.5 + companyLines.length * 4.2;

  // title block (right)
  pdf.setFont('Carlito', 'bold');
  pdf.setFontSize(22);
  pdf.setTextColor(...LEAF);
  pdf.text('SALES ORDER', W - M, 20, { align: 'right' });
  pdf.setDrawColor(...GOLD);
  pdf.setLineWidth(0.5);
  pdf.line(W - M - 46, 23, W - M, 23);

  const meta: [string, string][] = [
    ['Order No.', orderNo],
    ['Order Date', date.toLocaleDateString('en-GB')],
    ['Status', orderStatus(order)],
  ];
  pdf.setFontSize(9.5);
  meta.forEach(([k, v], i) => {
    const yy = 30 + i * 5.2;
    pdf.setFont('Carlito', 'normal');
    pdf.setTextColor(...MUTED);
    pdf.text(k, W - M - 34, yy, { align: 'right' });
    pdf.setFont('Carlito', 'bold');
    pdf.setTextColor(...INK);
    pdf.text(v, W - M, yy, { align: 'right' });
  });

  y = Math.max(leftBottom, 48) + 4;
  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.3);
  pdf.line(M, y, W - M, y);
  y += 5;

  // ---- bill to / order info boxes
  const boxW = (W - 2 * M - 6) / 2;
  const billRows: [string, string][] = [
    ['Mobile', order.mobile],
    ['City', order.city],
    ...(order.gstNo ? ([['GSTIN', order.gstNo]] as [string, string][]) : []),
    ...(order.agentName ? ([['Agent', order.agentName]] as [string, string][]) : []),
  ];
  const salesPeople = Array.from(new Set(lines.map((l) => l.salesPerson).filter(Boolean))) as string[];
  const totalQty = lines.reduce((a, l) => a + l.totalQuantity, 0);
  const totalAmt = lines.reduce((a, l) => a + l.totalAmount, 0);
  const infoRows: [string, string][] = [
    ['Designs', String(lines.length)],
    ['Total Pieces', `${totalQty} pcs`],
    ...(salesPeople.length ? ([['Sales Person', salesPeople.join(', ')]] as [string, string][]) : []),
  ];
  const boxH = 12 + Math.max(billRows.length + 1, infoRows.length) * 4.8;

  const drawBox = (x: number, title: string, heading: string | null, rows: [string, string][]) => {
    pdf.setFillColor(...SOFT);
    pdf.setDrawColor(...LINE);
    pdf.roundedRect(x, y, boxW, boxH, 2, 2, 'FD');
    pdf.setFont('Carlito', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...GOLD);
    pdf.text(title.toUpperCase(), x + 4, y + 5.5, { charSpace: 0.6 });
    let yy = y + 10.5;
    if (heading) {
      pdf.setFontSize(12);
      pdf.setTextColor(...INK);
      const hl = pdf.splitTextToSize(heading, boxW - 8)[0];
      pdf.text(hl, x + 4, yy);
      yy += 5.2;
    }
    pdf.setFontSize(9.5);
    rows.forEach(([k, v]) => {
      pdf.setFont('Carlito', 'normal');
      pdf.setTextColor(...MUTED);
      pdf.text(k, x + 4, yy);
      pdf.setFont('Carlito', 'bold');
      pdf.setTextColor(...INK);
      const vv = pdf.splitTextToSize(v || '—', boxW - 30)[0];
      pdf.text(vv, x + 26, yy);
      yy += 4.8;
    });
  };
  drawBox(M, 'Bill To', order.firmName || '—', billRows);
  drawBox(M + boxW + 6, 'Order Summary', null, infoRows);
  y += boxH + 6;

  // ---- items table
  type Cell = string | { content: string; rowSpan?: number; styles?: Record<string, unknown>; _img?: string | null; _kind?: string };
  const body: Cell[][] = [];
  lines.forEach((l: OrderLine, li) => {
    const colors = Object.entries(l.items).filter(([, q]) => q > 0);
    const designText = [`#${l.designNumber}`, [l.fabric, l.work].filter(Boolean).join(' · ')].filter(Boolean).join('\n');
    const anyColorImg = colors.some(([c]) => !!colorImgs[li][c]);
    colors.forEach(([color, qty], ci) => {
      const row: Cell[] = [];
      if (ci === 0) {
        row.push({ content: String(li + 1), rowSpan: colors.length, styles: { halign: 'center', valign: 'middle' } });
        row.push({
          content: designText,
          rowSpan: colors.length,
          styles: { valign: 'middle', fontStyle: 'bold', cellPadding: { top: 2, bottom: 2, left: designImgs[li] ? 19 : 2.5, right: 2 }, minCellHeight: 22 },
          _img: designImgs[li],
          _kind: 'design',
        });
      }
      const cimg = colorImgs[li][color];
      row.push({
        content: color,
        styles: { valign: 'middle', cellPadding: { top: 2, bottom: 2, left: anyColorImg ? 12 : 2.5, right: 2 }, minCellHeight: anyColorImg ? 11 : 8 },
        _img: cimg,
        _kind: 'color',
      });
      row.push({ content: `${qty}`, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } });
      row.push({ content: rs(l.price), styles: { halign: 'right', valign: 'middle' } });
      row.push({ content: rs(qty * l.price), styles: { halign: 'right', valign: 'middle', fontStyle: 'bold' } });
      body.push(row);
    });
  });

  autoTable(pdf, {
    startY: y,
    margin: { left: M, right: M, top: 16, bottom: 18 },
    head: [['#', 'Design', 'Colour', 'Qty (pcs)', 'Rate', 'Amount']],
    body: body as never,
    theme: 'plain',
    rowPageBreak: 'avoid',
    styles: { font: 'Carlito', fontSize: 9.5, textColor: INK, cellPadding: 2.2, lineColor: LINE, lineWidth: { bottom: 0.25 } as never },
    headStyles: { fillColor: LEAF, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, cellPadding: { top: 2.6, bottom: 2.6, left: 2.5, right: 2.5 } },
    columnStyles: {
      0: { cellWidth: 9 },
      1: { cellWidth: 56 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index >= 3) {
        data.cell.styles.halign = data.column.index === 3 ? 'center' : 'right';
      }
    },
    didDrawCell: (data) => {
      if (data.section !== 'body') return;
      const raw = data.cell.raw as { _img?: string | null; _kind?: string } | undefined;
      if (!raw || !raw._img) return;
      const c = data.cell;
      if (raw._kind === 'design') {
        const iw = 14;
        const ih = 17.5;
        const iy = c.y + Math.max(2, (c.height - ih) / 2);
        pdf.addImage(raw._img, 'JPEG', c.x + 2.5, iy, iw, ih);
        pdf.setDrawColor(...LINE);
        pdf.rect(c.x + 2.5, iy, iw, ih);
      } else {
        const s = 8;
        pdf.addImage(raw._img, 'JPEG', c.x + 2.5, c.y + (c.height - s) / 2, s, s);
        pdf.setDrawColor(...LINE);
        pdf.rect(c.x + 2.5, c.y + (c.height - s) / 2, s, s);
      }
    },
  });

  // ---- totals
  const lastY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const needed = 62 + (order.remarks ? 16 : 0);
  y = lastY + 6;
  if (y + needed > H - 18) {
    pdf.addPage();
    y = 20;
  }

  const tW = 76;
  const tX = W - M - tW;
  pdf.setFont('Carlito', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(...MUTED);
  pdf.text('Total Quantity', tX + 3, y + 4);
  pdf.setTextColor(...INK);
  pdf.setFont('Carlito', 'bold');
  pdf.text(`${totalQty} pcs`, W - M - 3, y + 4, { align: 'right' });
  pdf.setFont('Carlito', 'normal');
  pdf.setTextColor(...MUTED);
  pdf.text('Sub Total', tX + 3, y + 9.5);
  pdf.setTextColor(...INK);
  pdf.text(rs(totalAmt), W - M - 3, y + 9.5, { align: 'right' });

  pdf.setFillColor(...LEAF);
  pdf.roundedRect(tX, y + 13, tW, 11, 1.5, 1.5, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('Carlito', 'bold');
  pdf.setFontSize(11);
  pdf.text('GRAND TOTAL', tX + 3.5, y + 20.2);
  pdf.setFontSize(13);
  pdf.text(rs(totalAmt), W - M - 3.5, y + 20.4, { align: 'right' });

  // amount in words (left)
  pdf.setFont('Carlito', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...GOLD);
  pdf.text('AMOUNT IN WORDS', M, y + 4, { charSpace: 0.6 });
  pdf.setFont('Carlito', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(...INK);
  const words = pdf.splitTextToSize(amountInWords(totalAmt), tX - M - 8);
  pdf.text(words, M, y + 9);
  y += 30;

  if (order.remarks) {
    pdf.setFont('Carlito', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...GOLD);
    pdf.text('REMARKS', M, y, { charSpace: 0.6 });
    pdf.setFont('Carlito', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(...INK);
    const r = pdf.splitTextToSize(order.remarks, W - 2 * M);
    pdf.text(r.slice(0, 3), M, y + 5);
    y += 6 + Math.min(r.length, 3) * 4.5;
  }

  // signatures
  const sy = Math.max(y + 18, H - 40);
  pdf.setDrawColor(...INK);
  pdf.setLineWidth(0.3);
  pdf.line(M, sy, M + 60, sy);
  pdf.line(W - M - 60, sy, W - M, sy);
  pdf.setFont('Carlito', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...MUTED);
  pdf.text(order.firmName || 'Customer', M, sy + 4.5);
  pdf.text(`For ${settings.companyName}`, W - M, sy + 4.5, { align: 'right' });
  pdf.setFont('Carlito', 'bold');
  pdf.setTextColor(...INK);
  pdf.text('Customer Signature', M, sy + 9);
  pdf.text('Authorised Signatory', W - M, sy + 9, { align: 'right' });

  // ---- footer on every page
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    pdf.setDrawColor(...GOLD);
    pdf.setLineWidth(0.3);
    pdf.line(M, H - 12, W - M, H - 12);
    pdf.setFont('Carlito', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...MUTED);
    pdf.text(settings.invoiceNote || 'Thank you for your business!', M, H - 7.5);
    pdf.text(`${orderNo}  ·  Page ${p} of ${pages}`, W - M, H - 7.5, { align: 'right' });
    if (p > 1) {
      pdf.setFillColor(...LEAF_DARK);
      pdf.rect(0, 0, W, 2.5, 'F');
    }
  }

  pdf.setProperties({ title: `Sales Order ${orderNo}`, author: settings.companyName, creator: 'GFive Sales' });
  return pdf;
}

export function invoiceFileName(order: Order): string {
  return `${displayOrderId(order).replace('#', '_')}_${(order.firmName || 'order').replace(/[^a-z0-9]+/gi, '_').slice(0, 30)}.pdf`;
}

export async function downloadInvoice(order: Order, settings: CompanySettings): Promise<void> {
  const pdf = await buildInvoicePdf(order, settings);
  pdf.save(invoiceFileName(order));
}

/** Opens the phone share sheet with the PDF (e.g. to send on WhatsApp). Returns false if unsupported. */
export async function shareInvoice(order: Order, settings: CompanySettings): Promise<boolean> {
  const pdf = await buildInvoicePdf(order, settings);
  const blob = pdf.output('blob');
  const file = new File([blob], invoiceFileName(order), { type: 'application/pdf' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Sales Order ${displayOrderId(order)}` });
    } catch {
      /* user cancelled */
    }
    return true;
  }
  pdf.save(invoiceFileName(order));
  return false;
}
