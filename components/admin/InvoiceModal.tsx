'use client';

import { useEffect, useState } from 'react';
import { Download, Loader2, Share2, X } from 'lucide-react';
import type { CompanySettings, Order } from '@/lib/types';
import { amountInWords, cldThumb, inr, tsToDate } from '@/lib/format';
import { displayOrderId, getOrderLines, orderSeller, orderStatus } from '@/lib/orders';
import { categoryName } from '@/lib/categories';
import { downloadInvoice, shareInvoice } from '@/lib/invoice';

/** On-screen preview of the sales order + a single Download (and Share on phones). */
export default function InvoiceModal({ order, settings, onClose }: { order: Order; settings: CompanySettings; onClose: () => void }) {
  const [busy, setBusy] = useState<'download' | 'share' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [canShare] = useState(() => {
    try {
      return !!navigator.share && !!navigator.canShare?.({ files: [new File([''], 'x.pdf', { type: 'application/pdf' })] });
    } catch {
      return false;
    }
  });
  const lines = getOrderLines(order);
  const date = tsToDate(order.createdAt) || new Date();
  const totalQty = lines.reduce((a, l) => a + l.totalQuantity, 0);
  const totalAmt = lines.reduce((a, l) => a + l.totalAmount, 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const run = async (kind: 'download' | 'share') => {
    setBusy(kind);
    setErr(null);
    try {
      if (kind === 'download') await downloadInvoice(order, settings);
      else await shareInvoice(order, settings);
    } catch (e) {
      console.error(e);
      setErr('Could not create the PDF. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black/55 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6" onClick={onClose}>
      <div
        className="mt-auto flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl bg-cream shadow-lift sm:mt-0 sm:max-w-3xl sm:rounded-3xl animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line bg-ivory px-5 py-3">
          <div>
            <p className="font-display text-xl font-semibold leading-tight">Sales order {displayOrderId(order)}</p>
            <p className="text-xs text-muted">Preview · the PDF uses the same layout on A4</p>
          </div>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-sand" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          {/* paper */}
          <div className="mx-auto max-w-[680px] overflow-hidden rounded-lg bg-white text-[13px] text-ink shadow-soft">
            <div className="h-1.5 bg-leaf-900" />
            <div className="h-0.5 bg-gold-500" />
            <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-7">
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/logo-wordmark.png" width={329} height={182} alt="GFive" className="h-14 w-auto" />
                <p className="mt-2 font-semibold">{settings.companyName}</p>
                <p className="text-xs text-muted">{settings.addressLine}</p>
                <p className="text-xs text-muted">{[settings.email, settings.website].filter(Boolean).join(' | ')}</p>
                {settings.gstin && <p className="text-xs text-muted">GSTIN: {settings.gstin}</p>}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tracking-wide text-leaf-700">SALES ORDER</p>
                <div className="ml-auto mt-1 h-px w-32 bg-gold-500" />
                <dl className="mt-2 space-y-0.5 text-xs">
                  <div><dt className="inline text-muted">Order No. </dt><dd className="inline font-semibold">{displayOrderId(order)}</dd></div>
                  <div><dt className="inline text-muted">Order Date </dt><dd className="inline font-semibold">{date.toLocaleDateString('en-GB')}</dd></div>
                  <div><dt className="inline text-muted">Status </dt><dd className="inline font-semibold">{orderStatus(order)}</dd></div>
                </dl>
              </div>
            </div>

            <div className="grid gap-3 px-5 sm:grid-cols-2 sm:px-7">
              <div className="rounded-lg border border-line bg-cream/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gold-600">Bill to</p>
                <p className="mt-1 text-base font-semibold">{order.firmName}</p>
                <p className="text-xs"><span className="text-muted">Mobile </span>{order.mobile}</p>
                <p className="text-xs"><span className="text-muted">City </span>{order.city}</p>
                {order.gstNo && <p className="text-xs"><span className="text-muted">GSTIN </span>{order.gstNo}</p>}
                {order.agentName && <p className="text-xs"><span className="text-muted">Agent </span>{order.agentName}</p>}
              </div>
              <div className="rounded-lg border border-line bg-cream/60 p-3 text-xs">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gold-600">Order summary</p>
                <p className="mt-1"><span className="text-muted">Designs </span>{lines.length}</p>
                <p><span className="text-muted">Total pieces </span>{totalQty} pcs</p>
                {lines.some((l) => l.salesPerson) && (
                  <p><span className="text-muted">Sales Person </span>{orderSeller(order).name}</p>
                )}
              </div>
            </div>

            <div className="mt-4 overflow-x-auto px-5 sm:px-7">
              <table className="w-full min-w-[480px] border-collapse text-xs">
                <thead>
                  <tr className="bg-leaf-700 text-left text-white">
                    <th className="p-2 font-semibold">Design</th>
                    <th className="p-2 font-semibold">Colour</th>
                    <th className="p-2 text-center font-semibold">Qty</th>
                    <th className="p-2 text-right font-semibold">Rate</th>
                    <th className="p-2 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) =>
                    Object.entries(l.items)
                      .filter(([, q]) => q > 0)
                      .map(([color, qty], i, arr) => (
                        <tr key={l.designNumber + color} className="border-b border-line">
                          {i === 0 && (
                            <td rowSpan={arr.length} className="p-2 align-middle">
                              <div className="flex items-center gap-2">
                                {l.image && (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={cldThumb(l.image, 80, 100)} alt="" className="h-12 w-10 rounded object-cover ring-1 ring-line" />
                                )}
                                <div>
                                  <p className="font-semibold">#{l.designNumber}</p>
                                  <p className="text-[11px] text-muted">{[categoryName(l.category), l.fabric, l.work].filter(Boolean).join(' · ')}</p>
                                </div>
                              </div>
                            </td>
                          )}
                          <td className="p-2">
                            <span className="flex items-center gap-2">
                              {l.colorPhotos[color] && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={cldThumb(l.colorPhotos[color], 48, 48)} alt="" className="size-6 rounded object-cover ring-1 ring-line" />
                              )}
                              {color}
                            </span>
                          </td>
                          <td className="p-2 text-center font-semibold">{qty}</td>
                          <td className="p-2 text-right">{inr(l.price, { decimals: true })}</td>
                          <td className="p-2 text-right font-semibold">{inr(qty * l.price, { decimals: true })}</td>
                        </tr>
                      )),
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-7">
              <div className="max-w-xs">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gold-600">Amount in words</p>
                <p className="mt-1 text-xs">{amountInWords(totalAmt)}</p>
                {order.remarks && (
                  <>
                    <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-gold-600">Remarks</p>
                    <p className="mt-1 text-xs">{order.remarks}</p>
                  </>
                )}
              </div>
              <div className="w-full sm:w-64">
                <div className="flex justify-between py-1 text-xs"><span className="text-muted">Total quantity</span><span className="font-semibold">{totalQty} pcs</span></div>
                <div className="flex justify-between py-1 text-xs"><span className="text-muted">Sub total</span><span>{inr(totalAmt, { decimals: true })}</span></div>
                <div className="mt-1 flex justify-between rounded-md bg-leaf-700 px-3 py-2 font-semibold text-white">
                  <span>GRAND TOTAL</span><span>{inr(totalAmt, { decimals: true })}</span>
                </div>
              </div>
            </div>
            <div className="mx-5 border-t border-gold-500/60 py-2 text-[11px] text-muted sm:mx-7">{settings.invoiceNote}</div>
          </div>
        </div>

        <div className="border-t border-line bg-ivory p-4">
          {err && <p className="mb-2 text-sm text-red-700">{err}</p>}
          <div className={`grid gap-2.5 ${canShare ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <button className="btn btn-primary h-12" disabled={!!busy} onClick={() => run('download')}>
              {busy === 'download' ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />} Download PDF
            </button>
            {canShare && (
              <button className="btn btn-whatsapp h-12" disabled={!!busy} onClick={() => run('share')}>
                {busy === 'share' ? <Loader2 size={17} className="animate-spin" /> : <Share2 size={17} />} Share PDF
              </button>
            )}
          </div>
          <p className="mt-2 text-center text-[11px] text-muted">Need a paper copy? Download the PDF and print it from your PDF viewer.</p>
        </div>
      </div>
    </div>
  );
}
