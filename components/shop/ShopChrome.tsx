'use client';

import { MessageCircle, MapPin, Phone } from 'lucide-react';
import { usePublicSettings } from '@/lib/public-db';

/** Minimal brand header for the customer order link. */
export function ShopHeader() {
  const s = usePublicSettings();
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-ivory/95 backdrop-blur-md">
      <div className="h-1 bg-leaf-900" />
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:h-16">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-wordmark.png" width={329} height={182} alt="GFive — Glamour Grace Unlimited" className="h-9 w-auto sm:h-11" />
        <a
          href={`https://wa.me/${s.whatsappNumber}`}
          target="_blank"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-[15px] text-leaf-800 hover:border-leaf-600/50"
        >
          <MessageCircle size={15} /> <span className="hidden sm:inline">Need help?</span> WhatsApp
        </a>
      </div>
    </header>
  );
}

export function ShopFooter() {
  const s = usePublicSettings();
  return (
    <footer className="mt-10 bg-weave text-ivory/80">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 py-8 text-center text-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-round.png" width={447} height={447} alt="GFive" className="size-14 rounded-full ring-1 ring-gold-400/40" />
        <p className="font-display text-lg text-ivory">Glamour Grace Unlimited</p>
        <p className="flex items-start justify-center gap-1.5 text-ivory/70">
          <MapPin size={15} className="mt-0.5 shrink-0 text-gold-400" />
          {s.addressLine}
        </p>
        {s.storePhone && (
          <a href={`tel:${s.storePhone}`} className="inline-flex items-center gap-1.5 text-ivory/70 hover:text-white">
            <Phone size={15} className="text-gold-400" /> {s.storePhone}
          </a>
        )}
        <p className="pt-2 text-xs text-ivory/40">© {new Date().getFullYear()} {s.companyName}</p>
      </div>
    </footer>
  );
}
