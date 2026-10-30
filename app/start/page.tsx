'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import type { ConfirmationResult, User } from 'firebase/auth';
import { ArrowRight, Factory, Loader2, LogOut, ShieldAlert, ShoppingBag, Smartphone } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { JW_BOOT } from '@/lib/jobwork';
import { otpErrorMessage, sendOtp, toE164 } from '@/lib/phone-auth';

type Jw = { status: 'checking' } | { status: 'yes'; name: string } | { status: 'no' } | { status: 'nophone' };

/** After login: one place to choose GFive Sales or GFive Job Work (production). */
export default function StartPage() {
  const { state, profile, signOut } = useAuth();
  const router = useRouter();
  const user = state.status === 'ready' || state.status === 'no-access' ? state.user : null;
  const [phone, setPhone] = useState<string | null>(null); // phone after linking (user object does not re-render)
  const myPhone = phone || user?.phoneNumber || '';
  const [found, setFound] = useState<{ phone: string; ok: boolean; name: string } | null>(null);

  useEffect(() => {
    if (state.status === 'signed-out') router.replace('/admin/login?next=/start');
  }, [state.status, router]);

  useEffect(() => {
    if (!myPhone || JW_BOOT.includes(myPhone)) return;
    let alive = true;
    getDoc(doc(db, 'jw_users', myPhone))
      .then((d) => alive && setFound({ phone: myPhone, ok: d.exists(), name: String(d.get('name') || '') }))
      .catch(() => alive && setFound({ phone: myPhone, ok: false, name: '' }));
    return () => {
      alive = false;
    };
  }, [myPhone]);

  const jw: Jw = !user
    ? { status: 'checking' }
    : !myPhone
      ? { status: 'nophone' }
      : JW_BOOT.includes(myPhone)
        ? { status: 'yes', name: '' }
        : found?.phone !== myPhone
          ? { status: 'checking' }
          : found.ok
            ? { status: 'yes', name: found.name }
            : { status: 'no' };

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-cream">
        <Loader2 className="animate-spin text-leaf-700" />
      </div>
    );
  }

  const name = profile?.name || (jw.status === 'yes' ? jw.name : '') || user.displayName || '';
  const who = [user.email, myPhone].filter(Boolean).join(' · ');

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-weave text-ivory">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-5 py-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-round.png" width={447} height={447} alt="GFive" className="size-14 rounded-full ring-1 ring-gold-400/50" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow !text-gold-400">GFive Dashboard</p>
            <h1 className="font-display text-3xl font-semibold">Namaste{name ? `, ${name}` : ''}</h1>
            <p className="truncate text-sm text-ivory/70">{who}</p>
          </div>
          <button onClick={() => signOut()} className="inline-flex items-center gap-1.5 rounded-full border border-ivory/30 px-4 py-2 text-sm hover:bg-ivory/10">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-4xl gap-5 px-5 py-8 sm:grid-cols-2">
        {/* Sales */}
        {state.status === 'ready' ? (
          <Link href="/admin/orders" className="card group flex flex-col p-6 transition hover:shadow-lift">
            <span className="grid size-14 place-items-center rounded-2xl bg-leaf-50 text-leaf-800"><ShoppingBag size={28} /></span>
            <h2 className="mt-4 font-display text-3xl font-semibold">Sales</h2>
            <p className="mt-1 flex-1 text-muted">Orders, leads, samples, design catalogue, Sales Person performance.</p>
            <span className="btn btn-primary mt-5 self-start">Open Sales <ArrowRight size={16} className="transition group-hover:translate-x-0.5" /></span>
          </Link>
        ) : (
          <Disabled icon={ShoppingBag} title="Sales" text={state.status === 'no-access' ? state.reason : 'Checking…'} />
        )}

        {/* Job Work */}
        {jw.status === 'yes' ? (
          <a href="/production" className="card group flex flex-col p-6 transition hover:shadow-lift">
            <span className="grid size-14 place-items-center rounded-2xl bg-gold-50 text-gold-600"><Factory size={28} /></span>
            <h2 className="mt-4 font-display text-3xl font-semibold">Job Work</h2>
            <p className="mt-1 flex-1 text-muted">Fabric inward, issue &amp; receive with karigars, TNA, samples, stock, ledger.</p>
            <span className="btn btn-primary mt-5 self-start">Open Job Work <ArrowRight size={16} className="transition group-hover:translate-x-0.5" /></span>
          </a>
        ) : jw.status === 'nophone' ? (
          <LinkPhone user={user} onLinked={setPhone} />
        ) : jw.status === 'no' ? (
          <Disabled icon={Factory} title="Job Work" text={`Your mobile ${myPhone} is not added in Job Work. Ask a super admin to add it (Job Work → More → Users).`} />
        ) : (
          <Disabled icon={Factory} title="Job Work" text="Checking…" />
        )}
      </main>
    </div>
  );
}

function Disabled({ icon: Icon, title, text }: { icon: typeof Factory; title: string; text: string }) {
  return (
    <div className="card flex flex-col p-6 opacity-80">
      <span className="grid size-14 place-items-center rounded-2xl bg-sand text-muted"><Icon size={28} /></span>
      <h2 className="mt-4 font-display text-3xl font-semibold text-muted">{title}</h2>
      <p className="mt-2 flex items-start gap-2 text-sm text-muted">
        {text === 'Checking…' ? <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" /> : <ShieldAlert size={16} className="mt-0.5 shrink-0" />}
        {text}
      </p>
    </div>
  );
}

/** E-mail login without a mobile: add the mobile once (OTP) so Job Work opens with the same login. */
function LinkPhone({ user, onLinked }: { user: User; onLinked: (phone: string) => void }) {
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [conf, setConf] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const send = async () => {
    const p = toE164(mobile);
    if (!p) return setErr('Please enter a valid 10-digit mobile number.');
    setBusy(true);
    setErr(null);
    try {
      setConf(await sendOtp(p, 'link-recaptcha', { link: user, visible }));
    } catch (e) {
      if ((e as { code?: string }).code === 'auth/captcha-check-failed') setVisible(true);
      setErr(otpErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    if (!conf || !/^\d{6}$/.test(code)) return setErr('Enter the 6-digit OTP.');
    setBusy(true);
    setErr(null);
    try {
      const cred = await conf.confirm(code);
      await cred.user.getIdToken(true); // new token now carries the mobile
      onLinked(cred.user.phoneNumber || toE164(mobile));
    } catch (e) {
      setErr(otpErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card flex flex-col p-6">
      <span className="grid size-14 place-items-center rounded-2xl bg-gold-50 text-gold-600"><Factory size={28} /></span>
      <h2 className="mt-4 font-display text-3xl font-semibold">Job Work</h2>
      <p className="mt-1 text-sm text-muted">Job Work uses your mobile number. Add it once — after that one login opens both.</p>
      {!conf ? (
        <div className="mt-4 flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Mobile number</span>
            <Smartphone size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input pl-10" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </label>
          <button className="btn btn-primary" onClick={send} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : null} Send OTP</button>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <input className="input flex-1" type="tel" inputMode="numeric" maxLength={6} placeholder="6-digit OTP" aria-label="OTP" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn btn-primary" onClick={verify} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : null} Verify</button>
        </div>
      )}
      <div id="link-recaptcha" className="mt-2" />
      {err && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
    </div>
  );
}
