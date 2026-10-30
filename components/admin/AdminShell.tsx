'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ClipboardList, Inbox, Shirt, PlusCircle, Users, Settings, LogOut, Loader2, ShieldAlert, Crown, Sparkles, UserRound, BarChart3, LayoutGrid } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ROLE_LABEL, type Permission } from '@/lib/permissions';
import NamePrompt from './NamePrompt';

// `need` = permission required to see the page (Super Admin always can)
const NAV: { href: string; label: string; icon: typeof ClipboardList; need?: Permission }[] = [
  { href: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { href: '/admin/leads', label: 'Leads', icon: Inbox },
  { href: '/admin/samples', label: 'Samples', icon: Shirt },
  { href: '/admin/samples/new', label: 'Add Sample', icon: PlusCircle, need: 'addSamples' },
  { href: '/admin/assistant', label: 'Ask AI', icon: Sparkles, need: 'askAI' },
  { href: '/admin/staff-sales', label: 'Sales Person Sales', icon: BarChart3, need: 'staffSales' },
  { href: '/admin/team', label: 'Team', icon: Users, need: 'manageTeam' },
  { href: '/admin/settings', label: 'Settings', icon: Settings, need: 'settings' },
];

function isActive(path: string, href: string) {
  if (href === '/admin/samples') return path === '/admin/samples' || /^\/admin\/samples\/[^/]+\/edit/.test(path);
  return path === href;
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { state, profile, isSuper, can, signOut, needsName } = useAuth();
  const roleLabel = profile ? ROLE_LABEL[profile.role] || 'Admin' : '';
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
          <p className="mt-1 text-xs text-muted">Signed in as {state.user.email || state.user.phoneNumber}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/start" className="btn btn-primary">GFive Dashboard</Link>
            <button className="btn btn-outline" onClick={() => signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const nav = NAV.filter((n) => !n.need || can(n.need));
  const blocked = NAV.find((n) => n.need && (path === n.href || path.startsWith(n.href + '/')) && !can(n.need));
  const extra = nav.filter((n) => ['/admin/staff-sales', '/admin/team', '/admin/settings'].includes(n.href));
  const bottom = nav.filter((n) => !extra.includes(n)).slice(0, 4);

  return (
    <div className="min-h-screen bg-cream lg:pl-64">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-weave text-ivory lg:flex">
        <div className="px-6 pb-4 pt-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-round.png" width={447} height={447} alt="GFive" className="size-14 rounded-full ring-1 ring-gold-400/50" />
          <p className="mt-3 font-display text-2xl font-semibold">GFive Sales</p>
          <p className="text-xs tracking-wide text-ivory/60">Admin studio</p>
          <Link href="/start" className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-ivory/25 px-3 py-1 text-xs text-ivory/80 hover:bg-white/5 hover:text-white">
            <LayoutGrid size={13} /> Dashboard · Job Work
          </Link>
        </div>
        <div className="gold-rule mx-6 opacity-50" />
        <nav className="mt-4 flex-1 space-y-1 px-3">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[17px] transition ${
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
            {isSuper && <Crown size={12} />} {roleLabel}
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
          <img src="/brand/logo-wordmark.png" width={329} height={182} alt="GFive" className="h-8 w-auto" />
          <span className="rounded-full bg-leaf-50 px-2 py-0.5 text-[13px] text-leaf-800">{roleLabel}</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/start" className="grid size-9 place-items-center rounded-full text-leaf-800 hover:bg-leaf-50" aria-label="GFive Dashboard (Sales / Job Work)"><LayoutGrid size={18} /></Link>
          {extra.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="grid size-9 place-items-center rounded-full text-leaf-800 hover:bg-leaf-50" aria-label={label}><Icon size={18} /></Link>
          ))}
          <Link href="/admin/profile" className="grid size-9 place-items-center rounded-full text-leaf-800 hover:bg-leaf-50" aria-label="My profile"><UserRound size={18} /></Link>
          <button onClick={() => signOut()} className="grid size-9 place-items-center rounded-full text-leaf-800 hover:bg-leaf-50" aria-label="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 lg:px-8 lg:pb-12 lg:pt-8">
        {blocked ? (
          <div className="card p-10 text-center text-muted">You don’t have access to this page. Ask the Super Admin to give you permission.</div>
        ) : (
          children
        )}
      </main>

      {/* Bottom nav (mobile) */}
      <nav style={{ gridTemplateColumns: `repeat(${bottom.length}, minmax(0, 1fr))` }} className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-ivory/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {bottom.map(({ href, label, icon: Icon }) => {
          const on = isActive(path, href);
          return (
            <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 py-2 text-[13px] ${on ? 'text-leaf-800' : 'text-muted'}`}>
              <span className={`grid h-7 w-12 place-items-center rounded-full ${on ? 'bg-leaf-100' : ''}`}>
                <Icon size={19} />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>
      {needsName && <NamePrompt />}
    </div>
  );
}
