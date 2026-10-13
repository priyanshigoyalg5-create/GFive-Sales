'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from 'lucide-react';
import { useAuth, authErrorMessage } from '@/lib/auth';

export default function LoginPage() {
  const { state, signIn, signOut, resetPassword } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'error' | 'ok'; text: string } | null>(null);

  useEffect(() => {
    if (state.status === 'ready') {
      const next = new URLSearchParams(window.location.search).get('next');
      router.replace(next && next.startsWith('/admin') && next !== '/admin/login' ? next : '/admin/orders');
    }
  }, [state.status, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setMsg({ type: 'error', text: authErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email.trim()) {
      setMsg({ type: 'error', text: 'Type your email above first, then tap “Forgot password”.' });
      return;
    }
    try {
      await resetPassword(email);
      setMsg({ type: 'ok', text: `Password reset link sent to ${email.trim()}.` });
    } catch (err) {
      setMsg({ type: 'error', text: authErrorMessage(err) });
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-weave p-12 text-ivory lg:flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-round.png" width={447} height={447} alt="GFive" className="size-24 rounded-full ring-1 ring-gold-400/50" />
        <div>
          <p className="eyebrow !text-gold-400">GFive Sales Studio</p>
          <h1 className="mt-3 font-display text-6xl font-semibold leading-[1.05]">
            Glamour <span className="gold-text italic">Grace</span>
            <br />
            Unlimited
          </h1>
          <p className="mt-4 max-w-sm text-ivory/70">Upload samples, share design links on WhatsApp and manage every order in one place.</p>
        </div>
        <p className="text-xs text-ivory/40">Staff access only</p>
      </div>

      <div className="flex items-center justify-center bg-cream px-5 py-12">
        <div className="w-full max-w-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-wordmark.png" width={329} height={182} alt="GFive" className="mx-auto h-16 w-auto lg:hidden" />
          <h2 className="mt-6 font-display text-4xl font-semibold text-ink lg:mt-0">Welcome back</h2>
          <p className="mt-1 text-sm text-muted">Sign in with your Admin or Super Admin account.</p>

          {state.status === 'no-access' && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {state.reason}
              <button className="mt-1 block font-medium underline" onClick={() => signOut()}>
                Sign out of {state.user.email}
              </button>
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="field-label">Email</span>
              <div className="relative">
                <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input className="input pl-10" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </label>
            <label className="block">
              <span className="field-label">Password</span>
              <div className="relative">
                <LockKeyhole size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  className="input px-10"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center text-muted" aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            {msg && (
              <p className={`rounded-lg px-3 py-2 text-sm ${msg.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-leaf-50 text-leaf-800'}`}>{msg.text}</p>
            )}

            <button type="submit" disabled={busy || state.status === 'loading'} className="btn btn-primary h-12 w-full">
              {busy ? <Loader2 size={18} className="animate-spin" /> : null}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <button type="button" onClick={forgot} className="block w-full text-center text-sm text-leaf-700 hover:underline">
              Forgot password?
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
