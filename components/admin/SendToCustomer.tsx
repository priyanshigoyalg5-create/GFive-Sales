'use client';

import { useEffect, useState } from 'react';
import { Copy, Check, ImageIcon, Loader2, X } from 'lucide-react';
import { copyImageToClipboard, fetchImageFile, sharePhotosWithText, waChatUrl } from '@/lib/wa-share';
import type { Order } from '@/lib/types';
import { digitsOnly } from '@/lib/format';
import { buildOrderWhatsAppText, displayOrderId, getOrderLines, orderSeller } from '@/lib/orders';
import { sampleLink } from '@/lib/samples';

/** Order message (same format as the WhatsApp order) for the salesperson to send to their customer. */
export function customerOrderText(o: Order): string {
  const seller = orderSeller(o);
  const lines = getOrderLines(o).map((l) => ({ ...l, salesPerson: seller.uid || seller.name !== 'Unassigned' ? seller.name : l.salesPerson }));
  return buildOrderWhatsAppText(displayOrderId(o), lines, {
    firmName: o.firmName,
    mobile: o.mobile,
    city: o.city,
    gstNo: o.gstNo || '',
    agentName: o.agentName || '',
    remarks: o.remarks || '',
  }, lines[0]?.sampleId ? sampleLink(lines[0].sampleId, seller.uid) : '');
}

function jpg(url: string) {
  return url.includes('res.cloudinary.com') && url.includes('/upload/') ? url.replace('/upload/', '/upload/w_1400,c_limit,q_85,f_jpg/') : url;
}

export default function SendToCustomer({ order, onClose }: { order: Order; onClose: () => void }) {
  const text = customerOrderText(order);
  const lines = getOrderLines(order);
  const images = Array.from(new Set(lines.map((l) => l.image).filter(Boolean))) as string[];
  const phone = digitsOnly(order.mobile);
  const waPhone = phone.length === 10 ? `91${phone}` : phone;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShareFiles] = useState(() => {
    try {
      return !!navigator.share && !!navigator.canShare?.({ files: [new File([''], 'x.jpg', { type: 'image/jpeg' })] });
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const openChat = () => window.open(waChatUrl(waPhone, text), '_blank');

  const files = async () =>
    (
      await Promise.all(
        images.slice(0, 5).map((u, i) => fetchImageFile(u, `${displayOrderId(order).replace('#', '_')}_${lines[i]?.designNumber || i + 1}.jpg`)),
      )
    ).filter(Boolean) as File[];

  /** Photo is compulsory: phone → share sheet; computer → copy photo + open the customer's chat. */
  const send = async () => {
    setBusy(true);
    setNote(null);
    try {
      const f = await files();
      if (canShareFiles && f.length) {
        const r = await sharePhotosWithText(f, text);
        if (r === 'shared') setNote('In WhatsApp, choose the customer’s chat and press Send.');
        else if (r === 'failed') setNote('Could not open the share sheet. Please try again.');
        return;
      }
      const ok = await copyImageToClipboard(f[0] || null);
      openChat();
      setNote(
        ok
          ? 'Photo copied. In the WhatsApp chat that opened, press Ctrl+V to attach the photo, then Send.'
          : 'Couldn’t copy the photo automatically — drag the photo from this window into the WhatsApp chat, then Send.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black/55 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6" onClick={onClose}>
      <div className="mt-auto flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-cream shadow-lift sm:mt-0 sm:max-w-md sm:rounded-3xl animate-fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line bg-ivory px-5 py-3">
          <div>
            <p className="font-display text-xl font-semibold leading-tight">Send to customer</p>
            <p className="text-xs text-muted">{order.firmName} · +{waPhone}</p>
          </div>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-sand" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* WhatsApp-style preview */}
          <div className="mx-auto max-w-[320px] overflow-hidden rounded-2xl bg-[#005c4b] text-[13px] text-white shadow-soft">
            {images[0] && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={jpg(images[0])} alt="" className="max-h-72 w-full object-cover" />
            )}
            <pre className="whitespace-pre-wrap p-3 font-sans leading-snug">{text.replace(/\*/g, '')}</pre>
          </div>
          {images.length > 1 && <p className="mt-2 text-center text-xs text-muted">+{images.length - 1} more design photo(s) will be attached</p>}
        </div>

        <div className="space-y-2.5 border-t border-line bg-ivory p-4">
          {note && <p className="rounded-lg bg-gold-50 px-3 py-2 text-xs text-ink ring-1 ring-gold-100">{note}</p>}
          <button className="btn btn-whatsapp h-12 w-full" onClick={send} disabled={busy || !images.length}>
            {busy ? <Loader2 size={17} className="animate-spin" /> : <ImageIcon size={17} />}
            {canShareFiles ? 'Send with photo' : 'Copy photo & open customer chat'}
          </button>
          <button
            className="btn btn-ghost btn-sm w-full"
            onClick={async () => {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy message'}
          </button>
          <p className="text-center text-[11px] text-muted">
            {canShareFiles
              ? 'The design photo is attached — pick the customer’s chat in WhatsApp and press Send.'
              : 'On a computer: the photo is copied and the customer’s chat opens — press Ctrl+V there to attach it.'}
          </p>
        </div>
      </div>
    </div>
  );
}
