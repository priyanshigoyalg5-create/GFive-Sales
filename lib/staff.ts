'use client';

import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { digitsOnly } from './format';
import type { PublicStaff } from './types';

/** "9163932222" / "+91 91639 32222" → "919163932222" */
export function normWhatsApp(v: string | undefined | null): string {
  let d = digitsOnly(v || '');
  if (d.length === 10) d = `91${d}`;
  return d;
}

/** Keeps publicStaff/{uid} (name + WhatsApp, readable by the customer order page) in sync. */
export async function syncPublicStaff(p: PublicStaff): Promise<void> {
  await setDoc(
    doc(db, 'publicStaff', p.uid),
    { uid: p.uid, name: p.name || '', whatsappNumber: normWhatsApp(p.whatsappNumber), active: p.active !== false },
    { merge: true },
  );
}

/** Customer page: look up the salesperson behind a link (`?ref=`). Returns null if unknown/disabled. */
/** All staff (for filters / attribution). Staff-only read. */
export function useStaffList(enabled = true) {
  const [list, setList] = useState<PublicStaff[]>([]);
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      collection(db, 'publicStaff'),
      (snap) => setList(snap.docs.map((d) => ({ ...(d.data() as PublicStaff), uid: d.id })).sort((a, b) => a.name.localeCompare(b.name))),
      () => setList([]),
    );
  }, [enabled]);
  return list;
}
