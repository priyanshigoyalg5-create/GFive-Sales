'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import type { CompanySettings } from './types';
import { DEFAULT_SETTINGS } from './settings-defaults';

export { DEFAULT_SETTINGS };

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
