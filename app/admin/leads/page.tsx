'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  Search, Phone, MessageCircle, Plus, Link2, Copy, Loader2, Flame, UserCheck, Inbox, Wand2, Settings2, X, CalendarClock, StickyNote, ChevronDown, Send,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { useLeadReceivers, useLeads, useOrders, useSamples } from '@/lib/hooks';
import { useStaffList } from '@/lib/staff';
import { cldThumb, formatDate, tsToDate } from '@/lib/format';
import { samplePhotos, sampleLink } from '@/lib/samples';
import { categoryName } from '@/lib/categories';
import {
  LEAD_SOURCES, LEAD_STATUSES, TEMP_STYLE, buildLeadContext, isOpen, leadSource, normPhone, pickAssignee, scoreLead,
  type Lead, type LeadSource, type LeadStatus, type LeadTemp,
} from '@/lib/leads';
import type { PublicStaff, Sample } from '@/lib/types';
import PageHeader from '@/components/admin/PageHeader';

type TempFilter = 'all' | LeadTemp | 'spam';

export default function LeadsPage() {
  const { profile, can } = useAuth();
  const uid = profile?.uid || '';
  const manage = can('manageLeads');
  const { leads, loading } = useLeads();
  const { orders } = useOrders();
  const { samples } = useSamples();
  const team = useStaffList(true);
  const receivers = useLeadReceivers();

  const [q, setQ] = useState('');
  const [temp, setTemp] = useState<TempFilter>('all');
  const [status, setStatus] = useState<'open' | LeadStatus | 'all'>('open');
  const [source, setSource] = useState<'' | LeadSource>('');
  const [person, setPerson] = useState(''); // '' all, 'none' unassigned, uid
  const [adding, setAdding] = useState(false);
  const [showReceivers, setShowReceivers] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [now] = useState(() => Date.now());

  const ctx = useMemo(() => buildLeadContext(orders, leads), [orders, leads]);
  const scored = useMemo(() => leads.map((l) => ({ l, s: scoreLead(l, ctx) })), [leads, ctx]);
  const sampleById = useMemo(() => new Map(samples.map((s) => [s.id, s])), [samples]);
  const sampleByNo = useMemo(() => new Map(samples.map((s) => [String(s.designNumber).toLowerCase(), s])), [samples]);

  // ---------- auto-transfer: give every new, unassigned, non-spam lead to one Sales Person
  const assigning = useRef(false);
  useEffect(() => {
    if (!manage || assigning.current || !team.length) return;
    const todo = scored.filter(({ l, s }) => !l.assignedUid && !s.spam && isOpen(l));
    if (!todo.length) return;
    assigning.current = true;
    const open = new Map<string, number>();
    leads.forEach((l) => l.assignedUid && isOpen(l) && open.set(l.assignedUid, (open.get(l.assignedUid) || 0) + 1));
    (async () => {
      for (const { l } of todo) {
        const who = pickAssignee(l, ctx, team, receivers, open);
        if (!who) break;
        open.set(who.uid, (open.get(who.uid) || 0) + 1);
        await updateDoc(doc(db, 'leads', l.id), {
          assignedUid: who.uid, assignedName: who.name, assignReason: `Auto · ${who.reason}`, assignedAt: serverTimestamp(), updatedAt: serverTimestamp(),
        }).catch((e) => console.error('auto-assign', e));
      }
      assigning.current = false;
    })();
  }, [manage, scored, team, receivers, ctx, leads]);

  // ---------- filters
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return scored
      .filter(({ l, s }) => {
        if (temp === 'spam' ? !s.spam : s.spam) return false;
        if (temp !== 'all' && temp !== 'spam' && s.temp !== temp) return false;
        if (status === 'open' ? !isOpen(l) : status !== 'all' && l.status !== status) return false;
        if (source && leadSource(l) !== source) return false;
        if (person === 'none' ? !!l.assignedUid : person && l.assignedUid !== person) return false;
        if (term) {
          const hay = [l.name, l.phone, l.city, l.handle, l.message, l.designNumber, l.assignedName].join(' ').toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.s.score - a.s.score) || ((tsToDate(b.l.createdAt)?.getTime() || 0) - (tsToDate(a.l.createdAt)?.getTime() || 0)));
  }, [scored, q, temp, status, source, person]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const open = scored.filter(({ l, s }) => isOpen(l) && !s.spam);
    return {
      today: scored.filter(({ l }) => (tsToDate(l.createdAt)?.getTime() || now) >= today.getTime()).length,
      hot: open.filter(({ s }) => s.temp === 'hot').length,
      unassigned: open.filter(({ l }) => !l.assignedUid).length,
      due: open.filter(({ l }) => l.followUpAt && l.followUpAt <= now + 86_400_000).length,
    };
  }, [scored, now]);

  return (
    <>
      <PageHeader
        eyebrow="Leads"
        title={manage ? 'All leads' : 'My leads'}
        subtitle={
          manage
            ? 'Enquiries from WhatsApp, Instagram, Facebook and the website. Each one is scored and given to one Sales Person automatically — you can transfer any lead.'
            : 'People who asked about your designs. Hot leads first — call or WhatsApp them.'
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {manage && (
              <button className="btn btn-outline" onClick={() => setShowReceivers(true)}>
                <Settings2 size={16} /> Who gets leads
              </button>
            )}
            <button className="btn btn-outline" onClick={() => setShowLinks(true)}>
              <Link2 size={16} /> Bio links
            </button>
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              <Plus size={16} /> Add lead
            </button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="New today" value={stats.today} icon={Inbox} />
        <Stat label="Hot (open)" value={stats.hot} icon={Flame} tone="text-red-700" />
        <Stat label="Follow-up due" value={stats.due} icon={CalendarClock} />
        {manage ? <Stat label="Not given yet" value={stats.unassigned} icon={Wand2} /> : <Stat label="Open leads" value={scored.filter(({ l, s }) => isOpen(l) && !s.spam).length} icon={UserCheck} />}
      </div>

      <div className="card mb-4 space-y-3 p-3 sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, mobile, city, design no." aria-label="Search leads" />
          </div>
          <Select value={source} onChange={(v) => setSource(v as LeadSource | '')} label="Source">
            <option value="">All sources</option>
            {(Object.keys(LEAD_SOURCES) as LeadSource[]).map((k) => <option key={k} value={k}>{LEAD_SOURCES[k].label}</option>)}
          </Select>
          {manage && (
            <Select value={person} onChange={setPerson} label="Sales Person">
              <option value="">All Sales Persons</option>
              <option value="none">Not given yet</option>
              {team.map((t) => <option key={t.uid} value={t.uid}>{t.name}</option>)}
            </Select>
          )}
          <Select value={status} onChange={(v) => setStatus(v as typeof status)} label="Status">
            <option value="open">Open</option>
            {LEAD_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            <option value="all">All</option>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Lead filter">
          {(['all', 'hot', 'warm', 'cold', 'spam'] as TempFilter[]).map((t) => (
            <button key={t} onClick={() => setTemp(t)} aria-pressed={temp === t} className={`chip ${temp === t ? 'chip-active' : ''}`}>
              {t === 'all' ? 'All' : t === 'spam' ? 'Spam' : <><span className={`size-2 rounded-full ${TEMP_STYLE[t].dot}`} /> {TEMP_STYLE[t].label}</>}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-24"><Loader2 className="animate-spin text-leaf-700" /></div>
      ) : shown.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="font-display text-2xl">No leads here</p>
          <p className="mt-1 text-sm text-muted">New enquiries from the website call-back form, WhatsApp, Instagram and Facebook will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(({ l, s }) => (
            <LeadCard
              key={l.id}
              lead={l}
              score={s}
              sample={(l.designId && sampleById.get(l.designId)) || (l.designNumber ? sampleByNo.get(l.designNumber.toLowerCase()) : undefined)}
              team={team}
              manage={manage}
              mine={l.assignedUid === uid}
              me={profile?.name || ''}
            />
          ))}
        </div>
      )}

      {adding && <AddLead onClose={() => setAdding(false)} samples={samples} team={team} manage={manage} />}
      {showLinks && <BioLinks refUid={manage ? '' : uid} onClose={() => setShowLinks(false)} />}
      {showReceivers && <Receivers team={team} receivers={receivers} onClose={() => setShowReceivers(false)} />}
    </>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Inbox; tone?: string }) {
  return (
    <div className="card p-4">
      <p className="flex items-center justify-between text-xs uppercase tracking-wide text-muted">{label} <Icon size={15} className={tone || 'text-gold-600'} /></p>
      <p className={`mt-1 font-display text-3xl font-semibold ${tone || 'text-leaf-800'}`}>{value}</p>
    </div>
  );
}

function Select({ value, onChange, label, children }: { value: string; onChange: (v: string) => void; label: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input appearance-none pr-9 md:w-44" aria-label={label}>
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
}

function waLink(phone: string, text: string) {
  return `https://api.whatsapp.com/send?phone=${normPhone(phone)}&text=${encodeURIComponent(text)}`;
}

function LeadCard({
  lead: l, score: s, sample, team, manage, mine, me,
}: {
  lead: Lead;
  score: ReturnType<typeof scoreLead>;
  sample?: Sample;
  team: PublicStaff[];
  manage: boolean;
  mine: boolean;
  me: string;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [told, setTold] = useState<PublicStaff | null>(null);
  const created = tsToDate(l.createdAt);
  const style = TEMP_STYLE[s.temp];
  const editable = manage || mine;
  const photo = sample ? samplePhotos(sample)[0] : '';
  const link = sample ? sampleLink(sample.id, l.assignedUid || undefined) : '';
  const greet = `Namaste ${l.name || ''} 🙏\nGFive Kolkata se ${l.assignedName || me} bol rahe hain.${sample ? `\nAapne Design #${sample.designNumber} ke baare mein poocha tha — photo, rate aur colours yahan dekhein aur order karein:\n${link}` : ''}`;

  const patch = (data: Record<string, unknown>) => updateDoc(doc(db, 'leads', l.id), { ...data, updatedAt: serverTimestamp() });

  const transfer = async (to: string) => {
    const p = team.find((t) => t.uid === to);
    setBusy(true);
    await patch(p
      ? { assignedUid: p.uid, assignedName: p.name, assignReason: `Transferred by ${me}`, assignedAt: serverTimestamp() }
      : { assignedUid: '', assignedName: '', assignReason: '' });
    setBusy(false);
    if (p) setTold(p);
  };

  const addNote = async () => {
    const text = note.trim();
    if (!text) return;
    setBusy(true);
    await patch({ notes: [...(l.notes || []), { at: Date.now(), by: me, text }].slice(-30) });
    setNote('');
    setBusy(false);
  };

  return (
    <article className={`card overflow-hidden ${s.spam ? 'opacity-80' : ''}`}>
      <div className="flex flex-wrap items-start gap-3 p-4">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cldThumb(photo, 120, 150)} alt={`Design ${sample?.designNumber}`} width={60} height={75} loading="lazy" className="h-[75px] w-[60px] shrink-0 rounded-lg object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{l.name || l.handle || 'Unknown'}</p>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${s.spam ? 'bg-sand text-muted ring-line' : style.pill}`} title={s.reasons.join(' · ')}>
              {!s.spam && <span className={`size-1.5 rounded-full ${style.dot}`} />} {s.spam ? 'Spam' : `${style.label} · ${s.score}`}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${LEAD_SOURCES[leadSource(l)]?.color || 'bg-sand'}`}>{LEAD_SOURCES[leadSource(l)]?.label || leadSource(l)}</span>
            {s.repeatCustomer && <span className="rounded-full bg-leaf-50 px-2 py-0.5 text-xs text-leaf-800">Existing customer</span>}
            {l.kind === 'care' && <span className="rounded-full bg-red-700 px-2 py-0.5 text-xs font-medium text-white">Customer care</span>}
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {[l.city, l.handle && !l.name ? '' : l.handle, sample ? `Design #${sample.designNumber}${categoryName(sample.category) ? ` · ${categoryName(sample.category)}` : ''}` : l.designNumber ? `Design #${l.designNumber}` : '', l.qty ? `${l.qty} pcs` : '']
              .filter(Boolean)
              .join(' · ')}
          </p>
          {l.message && <p className="mt-1.5 rounded-lg bg-sand/60 px-3 py-2 text-sm">“{l.message}”</p>}
          {!s.spam && s.reasons.length > 0 && <p className="mt-1 text-xs text-muted">Why: {s.reasons.join(' · ')}</p>}
        </div>
        <div className="text-right text-xs text-muted">
          {created ? formatDate(created, true) : 'Just now'}
          {l.phone && (
            <div className="mt-2 flex justify-end gap-1.5">
              <a href={`tel:+${normPhone(l.phone)}`} className="inline-flex h-8 items-center gap-1 rounded-full border border-line px-3 text-xs text-leaf-800 hover:bg-leaf-50" aria-label={`Call ${l.name}`}>
                <Phone size={13} /> +{normPhone(l.phone)}
              </a>
              <a href={waLink(l.phone, greet)} target="_blank" rel="noreferrer" className="grid size-8 place-items-center rounded-full bg-[#25d366] text-white" aria-label={`WhatsApp ${l.name}`} title="WhatsApp with design link">
                <MessageCircle size={14} />
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-sand/30 px-4 py-3 text-sm">
        {manage ? (
          <label className="flex items-center gap-1.5">
            <span className="text-muted">Sales Person:</span>
            <select
              aria-label="Give this lead to"
              value={l.assignedUid}
              disabled={busy}
              onChange={(e) => transfer(e.target.value)}
              className="h-9 rounded-full border border-line bg-white px-3"
            >
              <option value="">— not given —</option>
              {team.filter((t) => t.active !== false || t.uid === l.assignedUid).map((t) => <option key={t.uid} value={t.uid}>{t.name}</option>)}
            </select>
          </label>
        ) : (
          <span className="text-muted">{mine ? 'Given to you' : `With ${l.assignedName || '—'}`}</span>
        )}
        {l.assignReason && <span className="text-xs text-muted">({l.assignReason})</span>}
        <span className="flex-1" />
        {editable && (
          <>
            <label className="flex items-center gap-1.5">
              <CalendarClock size={15} className="text-muted" />
              <input
                type="date"
                aria-label="Follow-up date"
                className="h-9 rounded-full border border-line bg-white px-3"
                value={l.followUpAt ? new Date(l.followUpAt).toISOString().slice(0, 10) : ''}
                onChange={(e) => patch({ followUpAt: e.target.value ? new Date(e.target.value + 'T10:00:00').getTime() : null })}
              />
            </label>
            <select aria-label="Lead status" value={l.status} onChange={(e) => patch({ status: e.target.value })} className="h-9 rounded-full border border-line bg-white px-3">
              {LEAD_STATUSES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </>
        )}
      </div>

      {told?.whatsappNumber && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-leaf-50 px-4 py-2 text-sm text-leaf-800">
          Lead given to {told.name}.
          <a
            className="btn btn-sm btn-whatsapp"
            target="_blank"
            rel="noreferrer"
            href={waLink(told.whatsappNumber, `New lead for you 🔔\n${l.name || l.handle} ${l.phone ? `(+${normPhone(l.phone)})` : ''}${l.city ? `, ${l.city}` : ''}\n${sample ? `Design #${sample.designNumber}\n` : ''}${l.message ? `“${l.message}”\n` : ''}Please call today. Details in GFive Sales → Leads.`)}
          >
            <Send size={14} /> Tell {told.name} on WhatsApp
          </a>
          <button className="ml-auto text-xs underline" onClick={() => setTold(null)}>Hide</button>
        </div>
      )}

      {(editable || (l.notes || []).length > 0) && (
        <div className="border-t border-line px-4 py-3">
          {(l.notes || []).slice(-3).map((n) => (
            <p key={n.at} className="text-sm"><span className="text-xs text-muted">{formatDate(new Date(n.at), true)} · {n.by}:</span> {n.text}</p>
          ))}
          {editable && (
            <div className="mt-2 flex gap-2">
              <input className="input h-9 text-sm" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} placeholder="Add a note (e.g. called, will order on Monday)" aria-label="Note" />
              <button className="btn btn-sm btn-outline" onClick={addNote} disabled={busy || !note.trim()} aria-label="Save note"><StickyNote size={14} /></button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black/55 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="mt-auto flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl bg-cream shadow-lift sm:mt-0 sm:max-w-lg sm:rounded-3xl animate-fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line bg-ivory px-5 py-3">
          <p className="font-display text-xl font-semibold">{title}</p>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-sand" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function AddLead({ onClose, samples, team, manage }: { onClose: () => void; samples: Sample[]; team: PublicStaff[]; manage: boolean }) {
  const { profile } = useAuth();
  const [f, setF] = useState({ name: '', phone: '', city: '', source: 'whatsapp' as LeadSource, design: '', qty: '', message: '', to: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim() && !f.phone.trim()) return setErr('Enter a name or mobile number.');
    setBusy(true);
    const sample = samples.find((s) => String(s.designNumber).toLowerCase() === f.design.trim().toLowerCase());
    // Admins add leads for themselves; managers choose (or leave for auto-transfer)
    const to = manage ? team.find((t) => t.uid === f.to) : { uid: profile!.uid, name: profile!.name };
    try {
      await addDoc(collection(db, 'leads'), {
        name: f.name.trim(),
        phone: normPhone(f.phone),
        city: f.city.trim(),
        source: f.source,
        message: f.message.trim(),
        designId: sample?.id || '',
        designNumber: sample?.designNumber || f.design.trim(),
        category: sample?.category || '',
        qty: Number(f.qty) || 0,
        status: 'new',
        assignedUid: to?.uid || '',
        assignedName: to?.name || '',
        assignReason: to ? (manage ? `Given by ${profile?.name}` : 'Added by them') : '',
        assignedAt: to ? serverTimestamp() : null,
        notes: [],
        createdByUid: profile!.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onClose();
    } catch (e2) {
      console.error(e2);
      setErr('Could not save the lead.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Add lead" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="field-label">Name / firm</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="block"><span className="field-label">Mobile</span><input className="input" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="98xxxxxxxx" /></label>
          <label className="block"><span className="field-label">City</span><input className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></label>
          <label className="block">
            <span className="field-label">Came from</span>
            <select className="input" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value as LeadSource })}>
              {(['whatsapp', 'instagram', 'facebook', 'manual'] as LeadSource[]).map((k) => <option key={k} value={k}>{LEAD_SOURCES[k].label}</option>)}
            </select>
          </label>
          <label className="block"><span className="field-label">Design no.</span><input className="input" list="lead-designs" value={f.design} onChange={(e) => setF({ ...f, design: e.target.value })} /></label>
          <label className="block"><span className="field-label">Pieces (if said)</span><input className="input" type="number" min={0} value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></label>
        </div>
        <datalist id="lead-designs">{samples.filter((s) => !s.isTrashed).map((s) => <option key={s.id} value={s.designNumber} />)}</datalist>
        <label className="block"><span className="field-label">What they said</span><textarea className="input" rows={2} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></label>
        {manage && (
          <label className="block">
            <span className="field-label">Give to</span>
            <select className="input" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}>
              <option value="">Automatic (lead filter decides)</option>
              {team.filter((t) => t.active !== false).map((t) => <option key={t.uid} value={t.uid}>{t.name}</option>)}
            </select>
          </label>
        )}
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
        <button className="btn btn-primary h-11 w-full" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Save lead</button>
      </form>
    </Modal>
  );
}

function Receivers({ team, receivers, onClose }: { team: PublicStaff[]; receivers: string[]; onClose: () => void }) {
  const [sel, setSel] = useState<string[]>(receivers);
  const [busy, setBusy] = useState(false);
  const active = team.filter((t) => t.active !== false);
  return (
    <Modal title="Who gets new leads" onClose={onClose}>
      <p className="text-sm text-muted">
        New leads go automatically: first to the Sales Person whose link the customer used, then to the Sales Person of an existing customer, otherwise in turn to the people ticked here (whoever has the fewest open leads). Nobody ticked = everyone.
      </p>
      <div className="mt-4 space-y-1">
        {active.map((t) => (
          <label key={t.uid} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-sand/60">
            <input type="checkbox" className="size-4 accent-leaf-700" checked={sel.includes(t.uid)} onChange={(e) => setSel((p) => (e.target.checked ? [...p, t.uid] : p.filter((x) => x !== t.uid)))} />
            {t.name}
          </label>
        ))}
      </div>
      <button
        className="btn btn-primary mt-4 h-11 w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await setDoc(doc(db, 'settings', 'leads'), { receivers: sel }, { merge: true });
          setBusy(false);
          onClose();
        }}
      >
        {busy && <Loader2 size={16} className="animate-spin" />} Save
      </button>
    </Modal>
  );
}

function BioLinks({ refUid, onClose }: { refUid: string; onClose: () => void }) {
  const [origin] = useState(() => (typeof window !== 'undefined' ? window.location.origin : ''));
  const [copied, setCopied] = useState('');
  const links = [
    { id: 'instagram', label: 'Instagram bio (@gfiveindia)', url: `${origin}/enquiry?from=instagram${refUid ? `&ref=${refUid}` : ''}` },
    { id: 'facebook', label: 'Facebook page button / posts', url: `${origin}/enquiry?from=facebook${refUid ? `&ref=${refUid}` : ''}` },
  ];
  return (
    <Modal title="Instagram & Facebook links" onClose={onClose}>
      <p className="text-sm text-muted">
        Put these links in the Instagram bio and on the Facebook page. Customers see the newest designs and can send an enquiry — it comes here as an Instagram / Facebook lead
        {refUid ? ' given to you.' : ' and is given to a Sales Person automatically.'}
      </p>
      <div className="mt-4 space-y-3">
        {links.map((l) => (
          <div key={l.id}>
            <span className="field-label">{l.label}</span>
            <div className="flex gap-2">
              <input className="input text-sm" readOnly value={l.url} aria-label={l.label} />
              <button
                type="button"
                className="btn btn-outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(l.url);
                  setCopied(l.id);
                  setTimeout(() => setCopied(''), 1500);
                }}
              >
                <Copy size={15} /> {copied === l.id ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
