'use client';

import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth, signOut, updateProfile } from 'firebase/auth';
import { Crown, Loader2, UserPlus, ShieldCheck, Mail, Ban, CheckCircle2, Eye, EyeOff, MessageCircle } from 'lucide-react';
import { db, getSecondaryApp } from '@/lib/firebase';
import { useAuth, authErrorMessage, SUPERADMIN_EMAILS } from '@/lib/auth';
import type { Role, StaffProfile } from '@/lib/types';
import PageHeader from '@/components/admin/PageHeader';
import { normWhatsApp, syncPublicStaff } from '@/lib/staff';

export default function TeamPage() {
  const { profile, resetPassword } = useAuth();
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '', whatsapp: '', role: 'admin' as Role });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  useEffect(
    () =>
      onSnapshot(collection(db, 'staff'), (snap) => {
        setStaff(
          snap.docs
            .map((d) => ({ ...(d.data() as StaffProfile), uid: d.id }))
            .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'superadmin' ? -1 : 1)),
        );
        setLoading(false);
      }),
    [],
  );

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (form.password.length < 6) return setMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
    setBusy(true);
    try {
      // Create the login on a secondary instance so the Super Admin stays signed in.
      const secAuth = getAuth(getSecondaryApp());
      const cred = await createUserWithEmailAndPassword(secAuth, form.email.trim(), form.password);
      await updateProfile(cred.user, { displayName: form.name.trim() });
      await setDoc(doc(db, 'staff', cred.user.uid), {
        uid: cred.user.uid,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        active: true,
        whatsappNumber: normWhatsApp(form.whatsapp),
        createdAt: serverTimestamp(),
        createdBy: profile?.email || '',
      });
      await syncPublicStaff({ uid: cred.user.uid, name: form.name.trim(), whatsappNumber: form.whatsapp, active: true });
      await signOut(secAuth);
      setMsg({ type: 'ok', text: `${form.name} can now sign in with ${form.email.trim()}. Share the password with them privately.` });
      setForm({ name: '', email: '', password: '', whatsapp: '', role: 'admin' });
    } catch (err) {
      setMsg({ type: 'error', text: authErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Super Admin" title="Team" subtitle="Admins can manage samples and orders. Super Admins can also manage the team, settings and permanently delete." />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="card divide-y divide-line">
          {loading ? (
            <div className="grid place-items-center py-16"><Loader2 className="animate-spin text-leaf-700" /></div>
          ) : (
            staff.map((s) => {
              const me = s.uid === profile?.uid;
              const locked = SUPERADMIN_EMAILS.includes((s.email || '').toLowerCase());
              return (
                <div key={s.uid} className={`flex flex-wrap items-center gap-3 p-4 ${s.active === false ? 'opacity-60' : ''}`}>
                  <span className={`grid size-11 shrink-0 place-items-center rounded-full font-display text-lg font-semibold ${s.role === 'superadmin' ? 'bg-gold-100 text-gold-600' : 'bg-leaf-50 text-leaf-800'}`}>
                    {(s.name || s.email || '?').slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-medium">
                      {s.name || '—'} {me && <span className="text-xs text-muted">(you)</span>}
                      {s.role === 'superadmin' && <Crown size={14} className="text-gold-500" />}
                    </p>
                    <p className="truncate text-sm text-muted">{s.email}</p>
                    <WhatsAppEdit staff={s} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={s.role}
                      disabled={me || locked}
                      onChange={(e) => updateDoc(doc(db, 'staff', s.uid), { role: e.target.value })}
                      className="h-9 rounded-full border border-line bg-white px-3 text-sm disabled:opacity-60"
                      title={locked ? 'Permanent Super Admin (set in environment)' : undefined}
                    >
                      <option value="admin">Admin</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={async () => {
                        await resetPassword(s.email);
                        alert(`Password reset email sent to ${s.email}`);
                      }}
                      title="Send password reset email"
                    >
                      <Mail size={14} />
                    </button>
                    {!me && !locked && (
                      <button
                        className={`btn btn-sm ${s.active === false ? 'btn-outline' : 'btn-outline !text-red-700'}`}
                        onClick={async () => {
                          const active = s.active === false;
                          await updateDoc(doc(db, 'staff', s.uid), { active });
                          await syncPublicStaff({ uid: s.uid, name: s.name, whatsappNumber: s.whatsappNumber || '', active });
                        }}
                      >
                        {s.active === false ? <><CheckCircle2 size={14} /> Enable</> : <><Ban size={14} /> Disable</>}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>

        <form onSubmit={add} className="card space-y-3 p-5 lg:self-start">
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold"><UserPlus size={20} className="text-gold-600" /> Add member</h2>
          <label className="block">
            <span className="field-label">Name</span>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="field-label">Email (used to sign in)</span>
            <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="block">
            <span className="field-label">WhatsApp number (orders from their links go here)</span>
            <input className="input" type="tel" inputMode="tel" placeholder="98xxxxxxxx" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          </label>
          <label className="block">
            <span className="field-label">Temporary password</span>
            <div className="relative">
              <input className="input pr-10" type={show ? 'text' : 'password'} required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center text-muted">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <div>
            <span className="field-label">Role</span>
            <div className="grid grid-cols-2 gap-2">
              {(['admin', 'superadmin'] as Role[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setForm({ ...form, role: r })}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm ${form.role === r ? 'border-leaf-700 bg-leaf-50 text-leaf-800' : 'border-line bg-white'}`}
                >
                  {r === 'admin' ? <ShieldCheck size={15} /> : <Crown size={15} />} {r === 'admin' ? 'Admin' : 'Super Admin'}
                </button>
              ))}
            </div>
          </div>
          {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.type === 'ok' ? 'bg-leaf-50 text-leaf-800' : 'bg-red-50 text-red-800'}`}>{msg.text}</p>}
          <button className="btn btn-primary h-11 w-full" disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />} Create login
          </button>
          <p className="text-xs text-muted">They can change the password later with “Forgot password” on the sign-in page.</p>
        </form>
      </div>
    </>
  );
}

function WhatsAppEdit({ staff }: { staff: StaffProfile }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(staff.whatsappNumber || '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const n = normWhatsApp(val);
    await updateDoc(doc(db, 'staff', staff.uid), { whatsappNumber: n });
    await syncPublicStaff({ uid: staff.uid, name: staff.name, whatsappNumber: n, active: staff.active !== false });
    setBusy(false);
    setEditing(false);
  };
  if (!editing)
    return (
      <button onClick={() => setEditing(true)} className="mt-0.5 inline-flex items-center gap-1 text-xs text-leaf-700 hover:underline">
        <MessageCircle size={12} /> {staff.whatsappNumber ? `+${staff.whatsappNumber}` : 'Add WhatsApp number'}
      </button>
    );
  return (
    <div className="mt-1 flex items-center gap-1.5">
      <input className="input h-8 max-w-44 text-sm" type="tel" value={val} onChange={(e) => setVal(e.target.value)} placeholder="98xxxxxxxx" autoFocus />
      <button className="btn btn-sm btn-primary !h-8" onClick={save} disabled={busy}>Save</button>
      <button className="btn btn-sm btn-ghost !h-8" onClick={() => setEditing(false)}>Cancel</button>
    </div>
  );
}
