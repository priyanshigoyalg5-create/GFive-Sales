'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Send, Loader2, CalendarDays, Trophy, UserRound, Clock, RotateCcw } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useOrders, useSamples } from '@/lib/hooks';
import { buildDigest } from '@/lib/analytics';
import { inr } from '@/lib/format';
import PageHeader from '@/components/admin/PageHeader';

type Msg = { role: 'user' | 'assistant'; content: string; error?: boolean };

const SUGGESTIONS = [
  'Aaj kitne orders aaye?',
  'Is mahine sabse zyada kaunsa design bika?',
  'Kis sales person ne sabse zyada sale kiya aur kyun?',
  'Kaunse orders 3 din se zyada pending hain?',
  'Is mahine vs pichle mahine — sale kitni badhi?',
  'Kaunse designs ka ek bhi order nahi aaya?',
];

/** Tiny formatter: **bold** and "•"/"-" bullet lines. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        const bullet = /^\s*[•\-*]\s+/.test(line);
        const body = line.replace(/^\s*[•\-*]\s+/, '');
        const parts = body.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
          p.startsWith('**') && p.endsWith('**') ? <strong key={j} className="font-semibold text-leaf-800">{p.slice(2, -2)}</strong> : <Fragment key={j}>{p}</Fragment>,
        );
        if (!line.trim()) return <div key={i} className="h-2" />;
        return bullet ? (
          <div key={i} className="flex gap-2 pl-1">
            <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-gold-500" />
            <span>{parts}</span>
          </div>
        ) : (
          <p key={i}>{parts}</p>
        );
      })}
    </>
  );
}

export default function AssistantPage() {
  const { state } = useAuth();
  const { orders, loading: lo } = useOrders();
  const { samples, loading: ls } = useSamples();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const digest = useMemo(() => (lo || ls ? null : buildDigest(orders, samples)), [orders, samples, lo, ls]);

  useEffect(() => {
    if (msgs.length) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, busy]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy || !digest || state.status !== 'ready') return;
    const next: Msg[] = [...msgs, { role: 'user', content: t }];
    setMsgs(next);
    setInput('');
    setBusy(true);
    try {
      const token = await state.user.getIdToken();
      const res = await fetch('/api/admin-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: next.filter((m) => !m.error).map(({ role, content }) => ({ role, content })),
          digest: buildDigest(orders, samples),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setMsgs((m) => [...m, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMsgs((m) => [...m, { role: 'assistant', content: (err as Error).message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const today = digest?.periods.today;
  const month = digest?.periods.thisMonth;
  const topDesign = month?.topDesigns[0];
  const topPerson = month?.salesPeople.find((p) => p.name !== 'Unassigned') || month?.salesPeople[0];

  const cards = [
    {
      icon: CalendarDays,
      label: "Today's orders",
      value: today ? String(today.orders) : '—',
      sub: today ? `${today.pcs} pcs · ${inr(today.amount)}` : '',
    },
    {
      icon: Trophy,
      label: 'Top design · this month',
      value: topDesign ? `#${topDesign.design}` : '—',
      sub: topDesign ? `${topDesign.pcs} pcs · ${topDesign.customers} buyer${topDesign.customers === 1 ? '' : 's'}` : 'No sales yet',
    },
    {
      icon: UserRound,
      label: 'Top sales person · this month',
      value: topPerson?.name || '—',
      sub: topPerson ? `${inr(topPerson.amount)} · ${topPerson.orders} order${topPerson.orders === 1 ? "" : "s"}` : 'No sales yet',
    },
    {
      icon: Clock,
      label: 'Pending > 3 days',
      value: digest ? String(digest.pendingOver3Days.length) : '—',
      sub: digest?.pendingOver3Days.length ? 'Needs follow-up' : 'All on track',
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="AI"
        title="Ask Gfive Insights"
        subtitle="Ask about orders, best sellers and your sales team — in Hindi, English or Hinglish."
        actions={
          msgs.length ? (
            <button className="btn btn-outline" onClick={() => setMsgs([])}>
              <RotateCcw size={15} /> New chat
            </button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-[0.12em] text-muted">{label}</span>
              <Icon size={16} className="shrink-0 text-gold-600" />
            </div>
            <p className="mt-2 truncate font-display text-[26px] font-semibold leading-none text-leaf-800">{value}</p>
            <p className="mt-1 truncate text-xs text-muted">{sub}</p>
          </div>
        ))}
      </div>

      <section className="card mt-6 flex min-h-[460px] flex-col overflow-hidden">
        <div className="flex-1 space-y-4 p-4 sm:p-6">
          {msgs.length === 0 && (
            <div className="py-6 text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-gold-50 text-gold-600 ring-1 ring-gold-100">
                <Sparkles size={24} />
              </span>
              <p className="mt-3 font-display text-2xl font-semibold">Kya jaanna chahte hain?</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                Numbers are calculated exactly from your orders; the AI explains them. Try one of these:
              </p>
              <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip h-auto py-2 text-left" disabled={!digest} onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-leaf-700 px-4 py-2.5 text-[15px] text-ivory">{m.content}</div>
              </div>
            ) : (
              <div key={i} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold-50 text-gold-600 ring-1 ring-gold-100">
                  <Sparkles size={15} />
                </span>
                <div
                  className={`max-w-[90%] space-y-1 rounded-2xl rounded-tl-md px-4 py-3 text-[15px] leading-relaxed ${
                    m.error ? 'border border-red-200 bg-red-50 text-red-800' : 'border border-line bg-cream/60 text-ink'
                  }`}
                >
                  <Rich text={m.content} />
                </div>
              </div>
            ),
          )}
          {busy && (
            <div className="flex items-center gap-3 text-sm text-muted">
              <span className="grid size-8 place-items-center rounded-full bg-gold-50 text-gold-600 ring-1 ring-gold-100">
                <Loader2 size={15} className="animate-spin" />
              </span>
              Analysing your sales…
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="border-t border-line bg-ivory p-3"
        >
          <div className="flex items-end gap-2 rounded-2xl border border-line bg-white p-1.5 pl-4 focus-within:border-leaf-600">
            <textarea
              rows={1}
              value={input}
              maxLength={1000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder={digest ? 'e.g. Pichle hafte Surat se kitna order aaya?' : 'Loading your sales data…'}
              className="max-h-32 flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-muted/70"
            />
            <button type="submit" disabled={busy || !input.trim() || !digest} className="grid size-10 shrink-0 place-items-center rounded-xl bg-leaf-700 text-ivory disabled:opacity-40" aria-label="Send">
              {busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-muted">
            Cancelled &amp; trashed orders are not counted. A sales person gets credit for designs uploaded in their name.
          </p>
        </form>
      </section>
    </>
  );
}
