'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { OrderLine } from './types';

export interface CartItem {
  sampleId: string;
  designNumber: string;
  price: number;
  image: string;
  fabric?: string;
  work?: string;
  salesPerson?: string;
  colors: string[]; // every colour the design comes in
  qty: Record<string, number>; // colour -> pcs
  colorPhotos: Record<string, string>;
  addedAt: number;
}

interface CartCtx {
  items: CartItem[];
  ready: boolean;
  totalPcs: number;
  totalAmount: number;
  upsert: (item: CartItem) => void;
  setQty: (sampleId: string, color: string, qty: number) => void;
  remove: (sampleId: string) => void;
  clear: () => void;
  get: (sampleId: string) => CartItem | undefined;
}

const STORAGE_KEY = 'gfive.cart.v1';
const Ctx = createContext<CartCtx | null>(null);

export function itemPcs(i: CartItem): number {
  return Object.values(i.qty).reduce((a, b) => a + (Number(b) || 0), 0);
}

export function cartItemToLine(i: CartItem): OrderLine {
  const items: Record<string, number> = {};
  const photos: Record<string, string> = {};
  Object.entries(i.qty).forEach(([c, q]) => {
    if (q > 0) {
      items[c] = q;
      if (i.colorPhotos[c]) photos[c] = i.colorPhotos[c];
    }
  });
  const totalQuantity = itemPcs({ ...i, qty: items });
  return {
    sampleId: i.sampleId,
    designNumber: i.designNumber,
    price: i.price,
    fabric: i.fabric || '',
    work: i.work || '',
    salesPerson: i.salesPerson || '',
    image: i.image,
    items,
    colorPhotos: photos,
    totalQuantity,
    totalAmount: totalQuantity * i.price,
  };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // localStorage is only available after hydration
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {
      /* ignore */
    }
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        try {
          setItems(e.newValue ? JSON.parse(e.newValue) : []);
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items, ready]);

  const upsert = useCallback((item: CartItem) => {
    setItems((prev) => {
      const clean = { ...item, qty: Object.fromEntries(Object.entries(item.qty).filter(([, q]) => q > 0)) };
      if (itemPcs(clean) === 0) return prev.filter((p) => p.sampleId !== item.sampleId);
      const idx = prev.findIndex((p) => p.sampleId === item.sampleId);
      if (idx === -1) return [...prev, clean];
      const copy = [...prev];
      copy[idx] = { ...clean, addedAt: prev[idx].addedAt };
      return copy;
    });
  }, []);

  const setQty = useCallback((sampleId: string, color: string, qty: number) => {
    setItems((prev) =>
      prev.map((p) => (p.sampleId === sampleId ? { ...p, qty: { ...p.qty, [color]: Math.max(0, Math.floor(qty) || 0) } } : p)),
    );
  }, []);

  const remove = useCallback((sampleId: string) => setItems((prev) => prev.filter((p) => p.sampleId !== sampleId)), []);
  const clear = useCallback(() => setItems([]), []);
  const get = useCallback((sampleId: string) => items.find((i) => i.sampleId === sampleId), [items]);

  const value = useMemo<CartCtx>(() => {
    const totalPcs = items.reduce((a, i) => a + itemPcs(i), 0);
    const totalAmount = items.reduce((a, i) => a + itemPcs(i) * i.price, 0);
    return { items, ready, totalPcs, totalAmount, upsert, setQty, remove, clear, get };
  }, [items, ready, upsert, setQty, remove, clear, get]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart must be used inside CartProvider');
  return c;
}

/** Remembers the customer's firm details on this device so repeat orders are quick. */
const CUSTOMER_KEY = 'gfive.customer.v1';
export function loadCustomer<T>(fallback: T): T {
  try {
    const raw = localStorage.getItem(CUSTOMER_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
export function saveCustomer(v: unknown) {
  try {
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}
