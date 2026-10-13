'use client';

import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { Loader2, Save, MessageCircle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { normWhatsApp, syncPublicStaff } from '@/lib/staff';
import PageHeader from '@/components/admin/PageHeader';

export default function ProfilePage() {
  const { profile } = useAuth();
  const [wa, setWa] = useState(profile?.whatsappNumber || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!profile) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = normWhatsApp(wa);
    if (n.length < 11) return setMsg('Please enter a valid WhatsApp number.');
    setBusy(true);
    setMsg(null);
    try {
      await updateDoc(doc(db, 'staff', profile.uid), { whatsappNumber: n });
      await syncPublicStaff({ uid: profile.uid, name: profile.name, whatsappNumber: n, active: true });
      setMsg('Saved. Orders from links you share will now open WhatsApp chat with +' + n + '.');
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="My account" title="My profile" subtitle="Customers who order from the links you share are sent to your WhatsApp." />
      <form onSubmit={save} className="card max-w-xl space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="field-label">Name</p>
            <p className="font-medium">{profile.name}</p>
          </div>
          <div>
            <p className="field-label">Role</p>
            <p className="font-medium">{profile.role === 'superadmin' ? 'Super Admin' : 'Admin'}</p>
          </div>
          <div className="col-span-2">
            <p className="field-label">Email</p>
            <p className="font-medium">{profile.email}</p>
          </div>
        </div>
        <label className="block">
          <span className="field-label">My WhatsApp number for orders</span>
          <div className="relative">
            <MessageCircle size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input pl-10" type="tel" inputMode="tel" value={wa} onChange={(e) => setWa(e.target.value)} placeholder="98xxxxxxxx" />
          </div>
          <span className="mt-1 block text-xs text-muted">If empty, orders open the company WhatsApp number (Settings).</span>
        </label>
        {msg && <p className="rounded-lg bg-leaf-50 px-3 py-2 text-sm text-leaf-800">{msg}</p>}
        <button className="btn btn-primary h-11" disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
        </button>
      </form>
    </>
  );
}
