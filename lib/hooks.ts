'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from './firebase';
import type { Order, Sample } from './types';

export function useSamples() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const q = query(collection(db, 'samples'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        setSamples(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Sample, 'id'>) })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError('Could not load designs. Please check your connection.');
        setLoading(false);
      },
    );
  }, []);
  return { samples, loading, error };
}

export function useOrders(enabled = true) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError('Could not load orders (permission or connection problem).');
        setLoading(false);
      },
    );
  }, [enabled]);
  return { orders, loading, error };
}
