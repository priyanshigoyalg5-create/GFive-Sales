'use client';

import { useState } from 'react';
import { setDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, Save } from 'lucide-react';
import { useSettings, SETTINGS_DOC } from '@/lib/settings';
import { digitsOnly } from '@/lib/format';
import type { CompanySettings } from '@/lib/types';
import PageHeader from '@/components/admin/PageHeader';
import WhatsAppBotCard from '@/components/admin/WhatsAppBotCard';

const FIELDS: { key: keyof CompanySettings; label: string; hint?: string }[] = [
  { key: 'companyName', label: 'Company name (on invoice)' },
  { key: 'addressLine', label: 'Address' },
  { key: 'email', label: 'Email' },
  { key: 'website', label: 'Website' },
  { key: 'gstin', label: 'GSTIN' },
  { key: 'whatsappNumber', label: 'WhatsApp number for orders', hint: 'With country code, e.g. 919163932222' },
  { key: 'storePhone', label: 'Store phone (shown in shop footer)' },
  { key: 'instagram', label: 'Instagram handle', hint: 'Without @, e.g. gfiveindia' },
  { key: 'invoiceNote', label: 'Invoice footer note' },
];

export default function SettingsPage() {
  const current = useSettings();
  const [msg, setMsg] = useState<string | null>(null);
  // remount the form when the saved settings arrive / change
  return <SettingsForm key={JSON.stringify(current)} current={current} msg={msg} setMsg={setMsg} />;
}

function SettingsForm({ current, msg, setMsg }: { current: CompanySettings; msg: string | null; setMsg: (m: string | null) => void }) {
  const [form, setForm] = useState<CompanySettings>(current);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      let wa = digitsOnly(form.whatsappNumber);
      if (wa.length === 10) wa = `91${wa}`;
      await setDoc(SETTINGS_DOC, { ...form, whatsappNumber: wa, updatedAt: serverTimestamp() }, { merge: true });
      setMsg('Saved. The shop and invoices now use these details.');
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Business" title="Settings" subtitle="Business details used on the shop, WhatsApp orders and PDF invoices." />
      <form onSubmit={save} className="card max-w-2xl space-y-4 p-5">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="field-label">{f.label}</span>
            <input className="input" value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            {f.hint && <span className="mt-1 block text-xs text-muted">{f.hint}</span>}
          </label>
        ))}
        {msg && <p className="rounded-lg bg-leaf-50 px-3 py-2 text-sm text-leaf-800">{msg}</p>}
        <button className="btn btn-primary h-11" disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save settings
        </button>
      </form>
      <div className="mt-6">
        <WhatsAppBotCard />
      </div>
    </>
  );
}
