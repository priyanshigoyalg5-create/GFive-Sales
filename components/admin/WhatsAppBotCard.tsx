'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Bot, CheckCircle2, Circle, Copy, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { normWhatsApp } from '@/lib/staff';

const KEYS: { key: string; label: string }[] = [
  { key: 'FIREBASE_SERVICE_ACCOUNT', label: 'Firebase service account' },
  { key: 'WA_TOKEN', label: 'WhatsApp access token' },
  { key: 'WA_PHONE_NUMBER_ID', label: 'Phone number ID' },
  { key: 'WA_APP_SECRET', label: 'Meta app secret' },
  { key: 'WA_VERIFY_TOKEN', label: 'Webhook verify token' },
];

/** Settings → WhatsApp bot: on/off, test numbers, setup checklist. */
export default function WhatsAppBotCard() {
  const { state } = useAuth();
  const [cfg, setCfg] = useState<{ on: boolean; testNumbers: string[] } | null>(null);
  const [tests, setTests] = useState('');
  const [env, setEnv] = useState<Record<string, boolean> | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [webhook] = useState(() => (typeof window !== 'undefined' ? `${window.location.origin}/api/whatsapp/webhook` : '/api/whatsapp/webhook'));

  useEffect(
    () =>
      onSnapshot(doc(db, 'config', 'whatsapp'), (s) => {
        const d = s.data() || {};
        const c = { on: d.on === true, testNumbers: (d.testNumbers as string[]) || [] };
        setCfg(c);
        setTests(c.testNumbers.join(', '));
      }, () => setCfg({ on: false, testNumbers: [] })),
    [],
  );
  useEffect(() => {
    if (state.status !== 'ready') return;
    state.user
      .getIdToken()
      .then((t) => fetch('/api/whatsapp/status', { headers: { Authorization: `Bearer ${t}` } }))
      .then((r) => (r.ok ? r.json() : null))
      .then(setEnv)
      .catch(() => setEnv(null));
  }, [state]);

  const save = async (patch: Partial<{ on: boolean; testNumbers: string[] }>) => {
    setBusy(true);
    await setDoc(doc(db, 'config', 'whatsapp'), patch, { merge: true });
    setBusy(false);
  };
  const ready = env && KEYS.every((k) => env[k.key]);

  return (
    <section className="card max-w-2xl space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold"><Bot size={20} className="text-gold-600" /> WhatsApp bot</h2>
          <p className="text-sm text-muted">Customers get the menu (new designs with photos, order, my orders, customer care). Every chat becomes a Lead.</p>
        </div>
        {cfg && (
          <button
            type="button"
            role="switch"
            aria-checked={cfg.on}
            aria-label="WhatsApp bot on/off"
            disabled={busy || !ready}
            onClick={() => save({ on: !cfg.on })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${cfg.on ? 'bg-leaf-700' : 'bg-line'} disabled:opacity-50`}
          >
            <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition ${cfg.on ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        )}
      </div>

      <div className="rounded-xl bg-sand/50 p-3">
        <p className="text-sm font-medium">Setup checklist (Vercel → Environment Variables)</p>
        <ul className="mt-2 space-y-1 text-sm">
          {KEYS.map((k) => (
            <li key={k.key} className="flex items-center gap-2">
              {env?.[k.key] ? <CheckCircle2 size={15} className="text-leaf-700" /> : <Circle size={15} className="text-muted" />}
              {k.label} <code className="text-xs text-muted">{k.key}</code>
            </li>
          ))}
        </ul>
        {!ready && <p className="mt-2 text-xs text-muted">The bot can be switched on when all five are set.</p>}
      </div>

      <div>
        <span className="field-label">Webhook URL (paste in Meta → WhatsApp → Configuration)</span>
        <div className="flex gap-2">
          <input className="input text-sm" readOnly value={webhook} aria-label="Webhook URL" />
          <button
            type="button"
            className="btn btn-outline"
            onClick={async () => {
              await navigator.clipboard.writeText(webhook);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <Copy size={15} /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <label className="block">
        <span className="field-label">Test mode: answer only these numbers</span>
        <input className="input" value={tests} onChange={(e) => setTests(e.target.value)} placeholder="e.g. 9830012345, 9163932222" />
        <span className="mt-1 block text-xs text-muted">Keep your own numbers here while testing. Empty = the bot answers every customer.</span>
      </label>
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={() => save({ testNumbers: tests.split(/[,\s]+/).map(normWhatsApp).filter((n) => n.length >= 12) })}
      >
        {busy && <Loader2 size={16} className="animate-spin" />} Save test numbers
      </button>
      {cfg && <p className="text-xs text-muted">Status: {cfg.on ? (cfg.testNumbers.length ? `ON · test mode (${cfg.testNumbers.length} numbers)` : 'ON · all customers') : 'OFF'}</p>}
    </section>
  );
}
