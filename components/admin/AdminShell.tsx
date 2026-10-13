'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ClipboardList, Shirt, PlusCircle, Users, Settings, LogOut, Loader2, ShieldAlert, Crown, Sparkles, UserRound, BarChart3 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const NAV = [
  { href: '/admin/orders', label: 'Orders', icon: ClipboardList, superOnly: false },
  { href: '/admin/samples', label: 'Samples', icon: Shirt, superOnly: false },
  { href: '/admin/samples/new', label: 'Add Sample', icon: PlusCircle, superOnly: false },
  { href: '/admin/assistant', label: 'Ask AI', icon: Sparkles, superOnly: false },
  { href: '/admin/staff-sales', label: 'Staff Sales', icon: BarChart3, superOnly: true },
  { href: '/admin/team', label: 'Team', icon: Users, superOnly: true },
  { href: '/admin/settings', label: 'Settings', icon: Settings, superOnly: true },
];

function isActive(path: string, href: string) {
  if (href === '/admin/samples') return path === '/admin/samples' || /^\/admin\/samples\/[^/]+\/edit/.test(path);
  return path === href;
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { state, profile, isSuper, signOut } = useAuth();
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'signed-out') router.replace(`/admin/login?next=${encodeURIComponent(path)}`);
  }, [state.status, router, path]);

  if (state.status === 'loading' || state.status === 'signed-out') {
    return (
      <div className="grid min-h-screen place-items-center bg-cream">
        <Loader2 className="animate-spin text-leaf-700" />
      </div>
    );
  }

  if (state.status === 'no-access') {
    return (
      <div className="grid min-h-screen place-items-center bg-cream px-4">
        <div className="card max-w-sm p-8 text-center">
          <ShieldAlert className="mx-auto text-red-700" size={40} />
          <h1 className="mt-3 font-display text-2xl font-semibold">No access</h1>
          <p className="mt-2 text-sm text-muted">{state.reason}</p>
          <p className="mt-1 text-xs text-muted">Signed in as {state.user.email}</p>
          <button className="btn btn-outline mt-5" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const nav = NAV.filter((n) => !n.superOnly || isSuper);
  const superPage = NAV.find((n) => n.superOnly && path.startsWith(n.href));

  return (
    <div className="min-h-screen bg-cream lg:pl-64">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-weave text-ivory lg:flex">
        <div className="px-6 pb-4 pt-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-round.png" alt="GFive" className="size-14 rounded-full ring-1 ring-gold-400/50" />
          <p className="mt-3 font-display text-2xl font-semibold">GFive Sales</p>
          <p className="text-xs tracking-wide text-ivory/60">Admin studio</p>
        </div>
        <div className="gold-rule mx-6 opacity-50" />
        <nav className="mt-4 flex-1 space-y-1 px-3">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition ${
                isActive(path, href) ? 'bg-ivory/12 text-white shadow-inner ring-1 ring-gold-400/30' : 'text-ivory/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={18} className={isActive(path, href) ? 'text-gold-400' : ''} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="m-3 rounded-xl bg-white/5 p-3">
          <Link href="/admin/profile" className="block truncate text-sm font-medium hover:text-gold-100">{profile?.name}</Link>
          <p className="flex items-center gap-1 text-xs text-gold-100/80">
            {isSuper && <Crown size={12} />} {isSuper ? 'Super Admin' : 'Admin'}
          </p>
          <button onClick={() => signOut()} className="mt-2 inline-flex items-center gap-1.5 text-xs text-ivory/70 hover:text-white">
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </aside>

      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-ivory/95 px-4 backdrop-blur lg:hidden">
        <Link href="/admin/orders" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-wordmark.png" alt="GFive" className="h-8 w-auto" />
          <span className="rounded-full bg-leaf-50 px-2 py-0.5 text-[11px] text-leaf-800">{isSuper ? 'Super Admin' : 'Admin'}</span>
        </Link>
        <div className="flex items-center gap-1">
          {isSuper && (
            <>
              <Link href="/admin/staff-sales" className="grid size-9 place-items-center rounded-full text-leaf-800 hover:bg-leaf-50" aria-label="Staff sales"><BarChart3 size={18} /></Link>
              <Link href="/admin/team" className="grid size-9 place-items-center rounded-full text-leaf-800 hover:bg-leaf-50" aria-label="Team"><Users size={18} /></Link>
              <Link href="/admin/settings" className="grid size-9 place-items-center rounded-full text-leaf-800 hover:bg-leaf-50" aria-label="Settings"><Settings size={18} /></Link>
            </>
          )}
          <Link href="/admin/profile" className="grid size-9 place-items-center rounded-full text-leaf-800 hover:bg-leaf-50" aria-label="My profile"><UserRound size={18} /></Link>
          <button onClick={() => signOut()} className="grid size-9 place-items-center rounded-full text-leaf-800 hover:bg-leaf-50" aria-label="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 lg:px-8 lg:pb-12 lg:pt-8">
        {superPage && !isSuper ? (
          <div className="card p-10 text-center text-muted">Only the Super Admin can open this page.</div>
        ) : (
          children
        )}
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-ivory/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.slice(0, 4).map(({ href, label, icon: Icon }) => {
          const on = isActive(path, href);
          return (
            <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${on ? 'text-leaf-800' : 'text-muted'}`}>
              <span className={`grid h-7 w-12 place-items-center rounded-full ${on ? 'bg-leaf-100' : ''}`}>
                <Icon size={19} />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
