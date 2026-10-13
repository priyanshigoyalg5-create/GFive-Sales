'use client';

import { useEffect, useState } from 'react';
import { Copy, Check, ImageIcon, Loader2, MessageCircle, Send, X } from 'lucide-react';
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

  const openChat = () => window.open(`https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(text)}`, '_blank');

  const shareWithPhoto = async () => {
    setBusy(true);
    setNote(null);
    try {
      const files = await Promise.all(
        images.slice(0, 5).map(async (u, i) => {
          const r = await fetch(jpg(u));
          const b = await r.blob();
          return new File([b], `${displayOrderId(order).replace('#', '_')}_${lines[i]?.designNumber || i + 1}.jpg`, { type: 'image/jpeg' });
        }),
      );
      if (files.length && navigator.canShare?.({ files, text })) {
        await navigator.share({ files, text });
        setNote('In WhatsApp, choose the customer’s chat and press Send.');
      } else {
        openChat();
        setNote('This device can’t attach photos to WhatsApp from the browser, so the chat opened with the text only.');
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setNote('Could not attach the photo. Try “Open customer chat” instead.');
      }
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
          {canShareFiles && images.length > 0 && (
            <button className="btn btn-whatsapp h-12 w-full" onClick={shareWithPhoto} disabled={busy}>
              {busy ? <Loader2 size={17} className="animate-spin" /> : <ImageIcon size={17} />} Send with photo
            </button>
          )}
          <button className={`btn h-12 w-full ${canShareFiles && images.length ? 'btn-outline' : 'btn-whatsapp'}`} onClick={openChat}>
            {canShareFiles && images.length ? <MessageCircle size={17} /> : <Send size={17} />} Open customer chat (text only)
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
              ? '“Send with photo” attaches the design photo — pick the customer’s chat in WhatsApp.'
              : 'Photos can be attached from a phone. On a computer the chat opens with the message only.'}
          </p>
        </div>
      </div>
    </div>
  );
}
