'use client';

import { useState } from 'react';
import { Loader2, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/auth';

/** Shown after sign-in until the person enters their real name (used as "Sales Person"). */
export default function NamePrompt() {
  const { profile, updateMyName } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 2) return setErr('Please enter your full name.');
    if (n.includes('@')) return setErr('Please enter your name, not your email.');
    setBusy(true);
    setErr(null);
    try {
      await updateMyName(n);
    } catch (e2) {
      setErr((e2 as Error).message || 'Could not save. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/55 px-4 backdrop-blur-sm">
      <form onSubmit={save} className="card w-full max-w-sm p-6 animate-fade-up">
        <span className="grid size-12 place-items-center rounded-full bg-gold-50 text-gold-600 ring-1 ring-gold-100">
          <UserRound size={22} />
        </span>
        <h2 className="mt-3 font-display text-3xl font-semibold">Apna naam daalein</h2>
        <p className="mt-1 text-sm text-muted">
          Yeh naam customers ko <b>Sales Person</b> ke roop mein dikhega aur aapke orders isi naam se aayenge.
        </p>
        <label className="mt-4 block">
          <span className="field-label">Your name</span>
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priyanshi Goyal" autoComplete="name" />
        </label>
        <p className="mt-1 text-xs text-muted">Signed in as {profile?.email}</p>
        {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
        <button className="btn btn-primary mt-4 h-11 w-full" disabled={busy}>
          {busy && <Loader2 size={16} className="animate-spin" />} Continue
        </button>
      </form>
    </div>
  );
}
