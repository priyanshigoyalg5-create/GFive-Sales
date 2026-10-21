'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { AtSign, CheckCircle2, Circle, Copy, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { DEFAULT_KEYWORDS } from '@/lib/whatsapp/store';

const KEYS = [
  { key: 'FIREBASE_SERVICE_ACCOUNT', label: 'Firebase service account' },
  { key: 'META_PAGE_ID', label: 'Facebook Page ID' },
  { key: 'META_IG_USER_ID', label: 'Instagram account ID' },
  { key: 'META_PAGE_TOKEN', label: 'Page access token' },
  { key: 'META_APP_SECRET', label: 'Meta app secret' },
  { key: 'META_VERIFY_TOKEN', label: 'Webhook verify token' },
];

/** Settings → Instagram & Facebook: auto-replies, comment keywords, captions, setup checklist. */
export default function SocialCard() {
  const { state } = useAuth();
  const [cfg, setCfg] = useState<{ on: boolean; keywords: string[]; showRate: boolean } | null>(null);
  const [kw, setKw] = useState('');
  const [env, setEnv] = useState<Record<string, boolean> | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin] = useState(() => (typeof window !== 'undefined' ? window.location.origin : ''));

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'config', 'social'),
        (s) => {
          const d = s.data() || {};
          const c = { on: d.on === true, keywords: (d.keywords as string[])?.length ? (d.keywords as string[]) : DEFAULT_KEYWORDS, showRate: d.showRate === true };
          setCfg(c);
          setKw(c.keywords.join(', '));
        },
        () => setCfg({ on: false, keywords: DEFAULT_KEYWORDS, showRate: false }),
      ),
    [],
  );
  useEffect(() => {
    if (state.status !== 'ready') return;
    state.user
      .getIdToken()
      .then((t) => fetch('/api/social/status', { headers: { Authorization: `Bearer ${t}` } }))
      .then((r) => (r.ok ? r.json() : null))
      .then(setEnv)
      .catch(() => setEnv(null));
  }, [state]);

  const save = async (patch: Partial<{ on: boolean; keywords: string[]; showRate: boolean }>) => {
    setBusy(true);
    await setDoc(doc(db, 'config', 'social'), patch, { merge: true });
    setBusy(false);
  };
  const ready = env && KEYS.every((k) => env[k.key]);
  const webhook = `${origin}/api/meta/webhook`;

  return (
    <section className="card max-w-2xl space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold"><AtSign size={20} className="text-gold-600" /> Instagram &amp; Facebook</h2>
          <p className="text-sm text-muted">DMs and comments like “price” get an automatic reply with the design and order link. Every person becomes a Lead. Post designs from the Samples page.</p>
        </div>
        {cfg && (
          <button
            type="button"
            role="switch"
            aria-checked={cfg.on}
            aria-label="Instagram and Facebook auto-replies on/off"
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
        {!ready && <p className="mt-2 text-xs text-muted">Auto-replies can be switched on when all of these are set. Leads are recorded even when replies are off.</p>}
      </div>

      <div>
        <span className="field-label">Webhook URL (Meta app → Webhooks → Instagram & Page)</span>
        <div className="flex gap-2">
          <input className="input text-sm" readOnly value={webhook} aria-label="Meta webhook URL" />
          <button type="button" className="btn btn-outline" onClick={async () => { await navigator.clipboard.writeText(webhook); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            <Copy size={15} /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">Subscribe: Instagram → messages, comments · Page → messages, feed.</p>
      </div>

      <label className="block">
        <span className="field-label">Comment words that send a DM</span>
        <input className="input" value={kw} onChange={(e) => setKw(e.target.value)} />
        <span className="mt-1 block text-xs text-muted">Any comment with one of these words (or a “?” / “₹”) gets one private DM with the design and order link.</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-leaf-700" checked={!!cfg?.showRate} onChange={(e) => save({ showRate: e.target.checked })} />
        Show the rate in post captions (otherwise: “comment PRICE, we will DM you”)
      </label>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => save({ keywords: kw.split(/[,\n]+/).map((x) => x.trim().toLowerCase()).filter(Boolean) })}>
        {busy && <Loader2 size={16} className="animate-spin" />} Save words
      </button>
    </section>
  );
}
