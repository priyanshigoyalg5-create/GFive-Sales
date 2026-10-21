'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from './firebase';
import type { Order, Sample } from './types';
import { DEFAULT_FILTER, readFilter, type Lead, type LeadFilter } from './leads';
import { doc } from 'firebase/firestore';
import { useAuth } from './auth';
import { tsToDate } from './format';

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

/**
 * Orders visible to the signed-in person.
 * - Super Admin: every order.
 * - Sub Admin with "See every Sales Person's orders": all orders.
 * - Admin (staff): ONLY orders credited to them (salesPersonUid == their uid).
 *   The Firestore rules enforce the same thing, so other staff's orders can't be
 *   read even with a hand-made request.
 */
export function useOrders(enabled = true) {
  const { profile, can } = useAuth();
  const uid = profile?.uid || '';
  const all = can('viewAllOrders'); // Super Admin, or Sub Admin allowed to see everyone's orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || !uid) return;
    const q = all
      ? query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'orders'), where('salesPersonUid', '==', uid));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }));
        // newest first (staff query has no orderBy so it needs no composite index)
        list.sort((a, b) => (tsToDate(b.createdAt)?.getTime() ?? Date.now()) - (tsToDate(a.createdAt)?.getTime() ?? Date.now()));
        setOrders(list);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError('Could not load orders (permission or connection problem).');
        setLoading(false);
      },
    );
  }, [enabled, uid, all]);
  return { orders, loading, error };
}

/**
 * Leads visible to the signed-in person: all of them for Super Admin / Sub Admin with
 * "See & transfer all leads"; otherwise only leads given to them (rules enforce the same).
 */
export function useLeads(enabled = true) {
  const { profile, can } = useAuth();
  const uid = profile?.uid || '';
  const all = can('manageLeads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!enabled || !uid) return;
    const q = all ? query(collection(db, 'leads'), orderBy('createdAt', 'desc')) : query(collection(db, 'leads'), where('assignedUid', '==', uid));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as Omit<Lead, 'id'>), id: d.id }));
        list.sort((a, b) => (tsToDate(b.createdAt)?.getTime() || 0) - (tsToDate(a.createdAt)?.getTime() || 0));
        setLeads(list);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      },
    );
  }, [enabled, uid, all]);
  return { leads, loading };
}

/** Lead filter + who receives new leads (settings/leads). */
export function useLeadFilter(): LeadFilter {
  const [f, setF] = useState<LeadFilter>(DEFAULT_FILTER);
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'settings', 'leads'),
        (s) => setF(readFilter(s.data())),
        () => setF(DEFAULT_FILTER),
      ),
    [],
  );
  return f;
}
