'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Bot, CheckCircle2, Circle, Copy, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { normWhatsApp } from '@/lib/staff';

type Provider = 'meta' | 'wati';
const KEYS: Record<Provider, { key: string; label: string }[]> = {
  meta: [
    { key: 'FIREBASE_SERVICE_ACCOUNT', label: 'Firebase service account' },
    { key: 'WA_TOKEN', label: 'WhatsApp access token' },
    { key: 'WA_PHONE_NUMBER_ID', label: 'Phone number ID' },
    { key: 'WA_APP_SECRET', label: 'Meta app secret' },
    { key: 'WA_VERIFY_TOKEN', label: 'Webhook verify token' },
  ],
  wati: [
    { key: 'FIREBASE_SERVICE_ACCOUNT', label: 'Firebase service account' },
    { key: 'WATI_API_ENDPOINT', label: 'WATI API endpoint' },
    { key: 'WATI_API_TOKEN', label: 'WATI API token' },
    { key: 'WATI_WEBHOOK_KEY', label: 'Webhook secret word' },
  ],
};

/** Settings → WhatsApp bot: on/off, test numbers, setup checklist. */
export default function WhatsAppBotCard() {
  const { state } = useAuth();
  const [cfg, setCfg] = useState<{ on: boolean; testNumbers: string[]; provider: Provider } | null>(null);
  const [tests, setTests] = useState('');
  const [env, setEnv] = useState<Record<string, boolean> | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin] = useState(() => (typeof window !== 'undefined' ? window.location.origin : ''));

  useEffect(
    () =>
      onSnapshot(doc(db, 'config', 'whatsapp'), (s) => {
        const d = s.data() || {};
        const c = { on: d.on === true, testNumbers: (d.testNumbers as string[]) || [], provider: (d.provider === 'wati' ? 'wati' : 'meta') as Provider };
        setCfg(c);
        setTests(c.testNumbers.join(', '));
      }, () => setCfg({ on: false, testNumbers: [], provider: 'meta' })),
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

  const provider: Provider = cfg?.provider || 'meta';
  const keys = KEYS[provider];
  const webhook = provider === 'wati' ? `${origin}/api/whatsapp/wati?key=YOUR_WATI_WEBHOOK_KEY` : `${origin}/api/whatsapp/webhook`;
  const save = async (patch: Partial<{ on: boolean; testNumbers: string[]; provider: Provider }>) => {
    setBusy(true);
    await setDoc(doc(db, 'config', 'whatsapp'), patch, { merge: true });
    setBusy(false);
  };
  const ready = env && keys.every((k) => env[k.key]);

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

      <div>
        <span className="field-label">Business number is connected to</span>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="WhatsApp provider">
          {([
            { id: 'meta', title: 'Meta Cloud API (direct)', hint: 'No monthly fee, only Meta charges' },
            { id: 'wati', title: 'WATI', hint: 'Keeps WATI inbox & team chat' },
          ] as const).map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={provider === o.id}
              disabled={busy}
              onClick={() => save({ provider: o.id, on: false })}
              className={`rounded-xl border px-3 py-2.5 text-left text-sm ${provider === o.id ? 'border-leaf-700 bg-leaf-50 text-leaf-800' : 'border-line bg-white'}`}
            >
              <span className="block font-medium">{o.title}</span>
              <span className="block text-xs text-muted">{o.hint}</span>
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">Changing this switches the bot OFF — switch it on again after checking.</p>
      </div>

      <div className="rounded-xl bg-sand/50 p-3">
        <p className="text-sm font-medium">Setup checklist (Vercel → Environment Variables)</p>
        <ul className="mt-2 space-y-1 text-sm">
          {keys.map((k) => (
            <li key={k.key} className="flex items-center gap-2">
              {env?.[k.key] ? <CheckCircle2 size={15} className="text-leaf-700" /> : <Circle size={15} className="text-muted" />}
              {k.label} <code className="text-xs text-muted">{k.key}</code>
            </li>
          ))}
        </ul>
        {!ready && <p className="mt-2 text-xs text-muted">The bot can be switched on when all of these are set.</p>}
      </div>

      <div>
        <span className="field-label">{provider === 'wati' ? 'Webhook URL (WATI → Webhooks → Message Received; put your secret word after key=)' : 'Webhook URL (paste in Meta → WhatsApp → Configuration)'}</span>
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
