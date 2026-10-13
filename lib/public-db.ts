'use client';

/**
 * Data access for the customer design page (/s/[id]).
 *
 * Uses the small "Firestore Lite" SDK (one-time reads/writes, no live listeners
 * and no Firebase Auth) so the page customers open from WhatsApp loads fast on
 * mobile data. Staff pages keep using the full SDK from ./firebase.
 */
import { useEffect, useState } from 'react';
import { addDoc, collection, doc, getDoc, getFirestore, runTransaction, serverTimestamp } from 'firebase/firestore/lite';
import { app } from './firebase-app';
import type { CompanySettings, PublicStaff, Sample } from './types';
import { DEFAULT_SETTINGS } from './settings-defaults';

const db = getFirestore(app);

export async function getSample(id: string): Promise<Sample | null> {
  const snap = await getDoc(doc(db, 'samples', id));
  return snap.exists() ? ({ ...(snap.data() as Omit<Sample, 'id'>), id: snap.id } as Sample) : null;
}

/** Public name + WhatsApp of a staff member (customer order links). */
export async function getPublicStaff(uid: string | null | undefined): Promise<PublicStaff | null> {
  if (!uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return null;
  try {
    const snap = await getDoc(doc(db, 'publicStaff', uid));
    if (!snap.exists()) return null;
    const d = snap.data() as PublicStaff;
    return d.active === false ? null : { ...d, uid };
  } catch {
    return null;
  }
}

/** Next sequential order number, e.g. "GFive#124" (atomic). */
export async function nextOrderNumber(): Promise<string> {
  const counterRef = doc(db, 'counters', 'sales_orders');
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const next = snap.exists() ? Number(snap.data().currentSeq || 0) + 1 : 1;
    tx.set(counterRef, { currentSeq: next }, { merge: true });
    return `GFive#${next}`;
  });
}

export async function createOrder(data: Record<string, unknown>): Promise<string> {
  const ref = await addDoc(collection(db, 'orders'), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

let settingsPromise: Promise<CompanySettings> | null = null;
function loadSettings(): Promise<CompanySettings> {
  settingsPromise ??= getDoc(doc(db, 'settings', 'company'))
    .then((s) => (s.exists() ? { ...DEFAULT_SETTINGS, ...(s.data() as Partial<CompanySettings>) } : DEFAULT_SETTINGS))
    .catch(() => DEFAULT_SETTINGS);
  return settingsPromise;
}

/** Company settings, read once per page load. */
export function usePublicSettings(): CompanySettings {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    let alive = true;
    loadSettings().then((s) => alive && setSettings(s));
    return () => {
      alive = false;
    };
  }, []);
  return settings;
}
