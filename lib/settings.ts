'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import type { CompanySettings } from './types';

export const DEFAULT_SETTINGS: CompanySettings = {
  companyName: 'Gfive Designer Studio Pvt Ltd',
  addressLine: '113, Park Street, Poddar Point, Block-A, 3rd Floor, Kolkata 700016',
  email: 'info@gfive.co.in',
  website: 'www.gfive.co.in',
  gstin: '19AJCG3693D1ZD',
  whatsappNumber: '919163932222',
  storePhone: '7044447483',
  instagram: 'gfiveindia',
  invoiceNote: 'Thank you for your business!',
};

export const SETTINGS_DOC = doc(db, 'settings', 'company');

/** Live company settings (falls back to defaults until a super admin saves them). */
export function useSettings(): CompanySettings {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    const unsub = onSnapshot(
      SETTINGS_DOC,
      (snap) => {
        if (snap.exists()) setSettings({ ...DEFAULT_SETTINGS, ...(snap.data() as Partial<CompanySettings>) });
      },
      () => {
        /* settings are optional — keep defaults if rules block reading */
      },
    );
    return () => unsub();
  }, []);
  return settings;
}
