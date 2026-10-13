'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, MessageCircle, MapPin, Mail, Globe, Phone, AtSign } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { useSettings } from '@/lib/settings';

function prettyPhone(n: string) {
  const d = n.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  return `+${d}`;
}

export function ShopHeader() {
  const { totalPcs, ready } = useCart();
  const settings = useSettings();
  const path = usePathname();

  return (
    <>
      <div className="bg-leaf-900 text-[12px] tracking-wide text-gold-100">
        <div className="mx-auto flex h-8 max-w-6xl items-center justify-center gap-2 px-4 sm:justify-between">
          <span className="hidden sm:inline">Designer unstitched suits · Wholesale orders welcome</span>
          <a href={`https://wa.me/${settings.whatsappNumber}`} className="inline-flex items-center gap-1.5 hover:text-white">
            <MessageCircle size={13} /> Order on WhatsApp · {prettyPhone(settings.whatsappNumber)}
          </a>
        </div>
      </div>
      <header className="sticky top-0 z-40 border-b border-line/80 bg-ivory/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center" aria-label="GFive home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-wordmark.png" alt="GFive — Glamour Grace Unlimited" className="h-10 w-auto sm:h-11" />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/"
              className={`hidden rounded-full px-4 py-2 text-sm tracking-wide sm:inline-flex ${path === '/' ? 'text-leaf-800' : 'text-muted hover:text-leaf-800'}`}
            >
              Collection
            </Link>
            <Link
              href="/cart"
              className="relative inline-flex h-10 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm text-leaf-800 transition hover:border-leaf-600/50"
              aria-label={`Cart, ${totalPcs} pieces`}
            >
              <ShoppingBag size={18} />
              <span className="hidden sm:inline">Cart</span>
              {ready && totalPcs > 0 && (
                <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-gold-500 px-1 text-[11px] font-semibold text-white ring-2 ring-ivory">
                  {totalPcs > 999 ? '999+' : totalPcs}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}

export function ShopFooter() {
  const s = useSettings();
  return (
    <footer className="mt-16 bg-weave text-ivory/80">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-3">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-round.png" alt="GFive" className="size-20 rounded-full ring-1 ring-gold-400/40" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ivory/70">
            Glamour Grace Unlimited — #1 in Kolkata karigari unstitched suits. This is our trade ordering desk for boutiques, retailers and agents.
          </p>
        </div>
        <div className="space-y-2.5 text-sm">
          <p className="eyebrow !text-gold-400">Visit us</p>
          <p className="flex gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-gold-400" />{s.addressLine}</p>
          <p className="flex gap-2"><Mail size={16} className="mt-0.5 shrink-0 text-gold-400" />{s.email}</p>
          {s.storePhone && (
            <a href={`tel:${s.storePhone}`} className="flex gap-2 hover:text-white"><Phone size={16} className="mt-0.5 shrink-0 text-gold-400" />{s.storePhone}</a>
          )}
          <a href={`https://${s.website.replace(/^https?:\/\//, '')}`} target="_blank" className="flex gap-2 hover:text-white"><Globe size={16} className="mt-0.5 shrink-0 text-gold-400" />{s.website} <span className="text-ivory/50">(retail store)</span></a>
          {s.instagram && (
            <a href={`https://www.instagram.com/${s.instagram}/`} target="_blank" className="flex gap-2 hover:text-white"><AtSign size={16} className="mt-0.5 shrink-0 text-gold-400" />@{s.instagram}</a>
          )}
        </div>
        <div className="space-y-3 text-sm">
          <p className="eyebrow !text-gold-400">How to order</p>
          <ol className="list-decimal space-y-1.5 pl-4 text-ivory/70">
            <li>Open a design and choose pieces per colour</li>
            <li>Add more designs to your cart</li>
            <li>Enter firm details and send the order on WhatsApp</li>
          </ol>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-ivory/50">
        © {new Date().getFullYear()} {s.companyName}
      </div>
    </footer>
  );
}
