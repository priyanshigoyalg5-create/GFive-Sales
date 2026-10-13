'use client';

import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { Crown, Loader2, UserPlus, ShieldCheck, Mail, Ban, CheckCircle2, Eye, EyeOff, MessageCircle, UserCog, ChevronDown } from 'lucide-react';
import { db, getSecondaryAuth } from '@/lib/firebase';
import { useAuth, authErrorMessage, SUPERADMIN_EMAILS } from '@/lib/auth';
import type { Role, StaffProfile } from '@/lib/types';
import PageHeader from '@/components/admin/PageHeader';
import { normWhatsApp, syncPublicStaff } from '@/lib/staff';
import { PERMISSIONS, ROLE_LABEL, SUBADMIN_DEFAULTS, cleanPermissions, type Permission, type PermissionMap } from '@/lib/permissions';

const ROLE_ORDER: Record<Role, number> = { superadmin: 0, subadmin: 1, admin: 2 };
const ROLE_INFO: Record<Role, { icon: typeof Crown; text: string }> = {
  admin: { icon: ShieldCheck, text: 'Sales Person: adds samples, shares links, sees only their own orders.' },
  subadmin: { icon: UserCog, text: 'Admin powers + only the extra powers you tick below.' },
  superadmin: { icon: Crown, text: 'Everything, including the team, settings and permanent delete.' },
};

export default function TeamPage() {
  const { profile, resetPassword, isSuper } = useAuth();
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '', whatsapp: '', role: 'admin' as Role });
  const [perms, setPerms] = useState<PermissionMap>(SUBADMIN_DEFAULTS);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null); // whose permissions are expanded

  // Super Admin can create any role; a Sub Admin with "Add / disable Admins" only Admins.
  const creatable: Role[] = isSuper ? ['admin', 'subadmin', 'superadmin'] : ['admin'];

  useEffect(
    () =>
      onSnapshot(collection(db, 'staff'), (snap) => {
        setStaff(
          snap.docs
            .map((d) => ({ ...(d.data() as StaffProfile), uid: d.id }))
            .sort((a, b) => (ROLE_ORDER[a.role] ?? 2) - (ROLE_ORDER[b.role] ?? 2) || (a.name || '').localeCompare(b.name || '')),
        );
        setLoading(false);
      }),
    [],
  );

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (form.password.length < 6) return setMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
    if (!creatable.includes(form.role)) return setMsg({ type: 'error', text: 'You can only add Admins.' });
    setBusy(true);
    try {
      // Create the login on a secondary instance so the current user stays signed in.
      const secAuth = getSecondaryAuth();
      const cred = await createUserWithEmailAndPassword(secAuth, form.email.trim(), form.password);
      await updateProfile(cred.user, { displayName: form.name.trim() });
      await setDoc(doc(db, 'staff', cred.user.uid), {
        uid: cred.user.uid,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        active: true,
        whatsappNumber: normWhatsApp(form.whatsapp),
        nameConfirmed: true,
        ...(form.role === 'subadmin' ? { permissions: cleanPermissions(perms) } : {}),
        createdAt: serverTimestamp(),
        createdBy: profile?.email || '',
      });
      await syncPublicStaff({ uid: cred.user.uid, name: form.name.trim(), whatsappNumber: form.whatsapp, active: true });
      await signOut(secAuth);
      setMsg({ type: 'ok', text: `${form.name} (${ROLE_LABEL[form.role]}) can now sign in with ${form.email.trim()}. Share the password with them privately.` });
      setForm({ name: '', email: '', password: '', whatsapp: '', role: 'admin' });
      setPerms(SUBADMIN_DEFAULTS);
    } catch (err) {
      setMsg({ type: 'error', text: authErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (s: StaffProfile, role: Role) => {
    const patch: Record<string, unknown> = { role };
    if (role === 'subadmin' && !s.permissions) patch.permissions = cleanPermissions(SUBADMIN_DEFAULTS);
    await updateDoc(doc(db, 'staff', s.uid), patch);
    if (role === 'subadmin') setOpen(s.uid);
  };

  return (
    <>
      <PageHeader
        eyebrow={isSuper ? 'Super Admin' : 'Sub Admin'}
        title="Team"
        subtitle="Admin = Sales Person. Sub Admin = Admin + the powers you choose for that person. Super Admin = everything."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <section className="card divide-y divide-line lg:self-start">
          {loading ? (
            <div className="grid place-items-center py-16"><Loader2 className="animate-spin text-leaf-700" /></div>
          ) : (
            staff.map((s) => {
              const me = s.uid === profile?.uid;
              const locked = SUPERADMIN_EMAILS.includes((s.email || '').toLowerCase());
              // a Sub Admin (manageTeam) may only manage plain Admins
              const canManage = !me && !locked && (isSuper || s.role === 'admin');
              const role: Role = s.role || 'admin';
              return (
                <div key={s.uid} className={`p-4 ${s.active === false ? 'opacity-70' : ''}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`grid size-11 shrink-0 place-items-center rounded-full font-display text-lg font-semibold ${role === 'superadmin' ? 'bg-gold-100 text-gold-600' : role === 'subadmin' ? 'bg-sand text-ink' : 'bg-leaf-50 text-leaf-800'}`}>
                      {(s.name || s.email || '?').slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 font-medium">
                        {s.name || '—'} {me && <span className="text-xs text-muted">(you)</span>}
                        {role === 'superadmin' && <Crown size={14} className="text-gold-500" />}
                        {s.active === false && <span className="rounded-full bg-red-50 px-2 text-xs text-red-700">Disabled</span>}
                      </p>
                      <p className="truncate text-sm text-muted">{s.email}</p>
                      {canManage || me ? <WhatsAppEdit staff={s} /> : s.whatsappNumber ? <p className="text-xs text-muted">+{s.whatsappNumber}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {isSuper ? (
                        <select
                          aria-label={`Role of ${s.name || s.email}`}
                          value={role}
                          disabled={me || locked}
                          onChange={(e) => changeRole(s, e.target.value as Role)}
                          className="h-9 rounded-full border border-line bg-white px-3 text-sm disabled:opacity-60"
                          title={locked ? 'Permanent Super Admin (set in environment)' : undefined}
                        >
                          <option value="admin">Admin</option>
                          <option value="subadmin">Sub Admin</option>
                          <option value="superadmin">Super Admin</option>
                        </select>
                      ) : (
                        <span className="rounded-full bg-sand px-3 py-1 text-sm">{ROLE_LABEL[role]}</span>
                      )}
                      {(canManage || me) && (
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={async () => {
                            await resetPassword(s.email);
                            alert(`Password reset email sent to ${s.email}`);
                          }}
                          title="Send password reset email"
                          aria-label={`Send password reset email to ${s.name || s.email}`}
                        >
                          <Mail size={14} />
                        </button>
                      )}
                      {canManage && (
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

                  {role === 'subadmin' && (
                    <div className="mt-3 rounded-xl border border-line bg-white/60">
                      <button
                        type="button"
                        onClick={() => setOpen(open === s.uid ? null : s.uid)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                        aria-expanded={open === s.uid}
                      >
                        <span>
                          <span className="font-medium">Powers</span>{' '}
                          <span className="text-muted">· {PERMISSIONS.filter((p) => cleanPermissions((s.permissions || {}) as PermissionMap)[p.key]).length} of {PERMISSIONS.length} on</span>
                        </span>
                        <ChevronDown size={16} className={`transition ${open === s.uid ? 'rotate-180' : ''}`} />
                      </button>
                      {open === s.uid && (
                        <div className="border-t border-line p-3">
                          <PermissionPicker
                            value={(s.permissions || {}) as PermissionMap}
                            disabled={!isSuper}
                            onChange={(next) => updateDoc(doc(db, 'staff', s.uid), { permissions: cleanPermissions(next) })}
                          />
                          {!isSuper && <p className="mt-2 text-xs text-muted">Only the Super Admin can change powers.</p>}
                        </div>
                      )}
                    </div>
                  )}
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
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center text-muted" aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <div>
            <span className="field-label">Role</span>
            <div className={`grid gap-2 ${creatable.length === 3 ? 'grid-cols-3' : 'grid-cols-1'}`}>
              {creatable.map((r) => {
                const Icon = ROLE_INFO[r].icon;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm({ ...form, role: r })}
                    aria-pressed={form.role === r}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-sm ${form.role === r ? 'border-leaf-700 bg-leaf-50 text-leaf-800' : 'border-line bg-white'}`}
                  >
                    <Icon size={15} /> {ROLE_LABEL[r]}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-muted">{ROLE_INFO[form.role].text}</p>
          </div>
          {form.role === 'subadmin' && (
            <div className="rounded-xl border border-line bg-white/60 p-3">
              <p className="mb-2 text-sm font-medium">Powers for this Sub Admin</p>
              <PermissionPicker value={perms} onChange={setPerms} />
            </div>
          )}
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

/** Tick-box list of every power, grouped. Options that need another option are greyed until it is on. */
function PermissionPicker({ value, onChange, disabled }: { value: PermissionMap; onChange: (v: PermissionMap) => void; disabled?: boolean }) {
  const v = cleanPermissions(value);
  const groups = Array.from(new Set(PERMISSIONS.map((p) => p.group)));
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <fieldset key={g}>
          <legend className="field-label !mb-1">{g}</legend>
          <div className="space-y-1">
            {PERMISSIONS.filter((p) => p.group === g).map((p) => {
              const need = (p as { needs?: Permission }).needs;
              const blocked = !!need && !v[need];
              return (
                <label key={p.key} className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-sand/60 ${blocked ? 'opacity-60' : ''}`}>
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-leaf-700"
                    checked={v[p.key]}
                    disabled={disabled || blocked}
                    onChange={(e) => onChange({ ...v, [p.key]: e.target.checked })}
                  />
                  <span className="text-sm leading-snug">
                    {p.label}
                    {'hint' in p && p.hint && <span className="block text-xs text-muted">{p.hint}</span>}
                    {blocked && need && <span className="block text-xs text-muted">Needs “{PERMISSIONS.find((x) => x.key === need)?.label}”</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
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
      <input className="input h-8 max-w-44 text-sm" type="tel" value={val} onChange={(e) => setVal(e.target.value)} placeholder="98xxxxxxxx" autoFocus aria-label="WhatsApp number" />
      <button className="btn btn-sm btn-primary !h-8" onClick={save} disabled={busy}>Save</button>
      <button className="btn btn-sm btn-ghost !h-8" onClick={() => setEditing(false)}>Cancel</button>
    </div>
  );
}
