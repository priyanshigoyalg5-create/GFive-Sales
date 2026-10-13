'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, Send, Loader2, MessageCircle } from 'lucide-react';
import { useSamples } from '@/lib/hooks';
import { useSettings } from '@/lib/settings';
import { cldThumb, inr } from '@/lib/format';
import { samplePhotos } from '@/lib/samples';

type Msg = { role: 'user' | 'assistant'; content: string; designs?: string[]; error?: boolean };

const STORAGE_KEY = 'gfive.chat.v1';
const SUGGESTIONS = ['Festive suits under ₹3,000', 'Kaunse colours available hain?', 'How do I place an order?', 'Store kahan hai?'];

const GREETING: Msg = {
  role: 'assistant',
  content: 'Namaste! 🙏 I am the Gfive assistant. Ask me about our designs, fabrics, colours, prices or how to order — English, Hindi or Hinglish, jo aapko pasand ho.',
};

export default function ChatAssistant() {
  const path = usePathname();
  const settings = useSettings();
  const { samples } = useSamples();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const designId = path.startsWith('/s/') ? path.split('/')[2] : undefined;
  const onProduct = !!designId;

  useEffect(() => {
    fetch('/api/chat')
      .then((r) => r.json())
      .then((d) => setEnabled(!!d.enabled))
      .catch(() => setEnabled(false));
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setMsgs(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-30)));
    } catch {
      /* ignore */
    }
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
    if (open) {
      setTeaser(false);
      try {
        sessionStorage.setItem('gfive.chat.teased', '1');
      } catch {
        /* ignore */
      }
    }
  }, [open]);

  // Small "Koi sawaal hai?" bubble a few seconds after the page opens (once per visit)
  useEffect(() => {
    if (!enabled) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem('gfive.chat.teased') === '1';
    } catch {
      /* ignore */
    }
    if (seen) return;
    const t = setTimeout(() => {
      setTeaser(true);
      try {
        sessionStorage.setItem('gfive.chat.teased', '1');
      } catch {
        /* ignore */
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [enabled]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content: t }];
    setMsgs(next);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.filter((m) => m !== GREETING && !m.error).map(({ role, content }) => ({ role, content })),
          context: { designId },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setMsgs((m) => [...m, { role: 'assistant', content: data.reply || '', designs: data.designs || [] }]);
    } catch (err) {
      setMsgs((m) => [...m, { role: 'assistant', content: (err as Error).message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  if (!enabled) return null;

  const byId = new Map(samples.map((s) => [s.id, s]));
  const fresh = msgs.length <= 1;

  return (
    <>
      {/* Launcher */}
      {!open && (
        <div className={`fixed right-4 z-40 flex flex-col items-end gap-2 sm:right-6 ${onProduct ? 'bottom-36 md:bottom-6' : 'bottom-5 sm:bottom-6'}`}>
          {teaser && (
            <div className="relative max-w-[240px] rounded-2xl rounded-br-sm border border-line bg-ivory px-4 py-3 pr-8 text-sm text-ink shadow-lift animate-fade-up">
              <button
                onClick={() => setTeaser(false)}
                className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full text-muted hover:bg-sand"
                aria-label="Hide message"
              >
                <X size={13} />
              </button>
              <button onClick={() => setOpen(true)} className="text-left">
                <span className="font-medium">Namaste! 🙏</span> Koi sawaal hai? Designs, price ya order ke baare mein mujhse chat karein.
              </button>
            </div>
          )}
          <button
            onClick={() => setOpen(true)}
            className="group inline-flex h-14 items-center gap-2.5 rounded-full bg-leaf-800 pl-2 pr-5 text-[15px] font-medium text-ivory shadow-lift ring-2 ring-gold-400/50 transition hover:bg-leaf-900 active:scale-95"
            aria-label="Chat with us"
          >
            <span className="relative grid size-10 place-items-center rounded-full bg-gold-500 text-white">
              <MessageCircle size={20} fill="currentColor" className="text-white" />
              <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-[#25d366] ring-2 ring-leaf-800" />
            </span>
            Chat with us
          </button>
        </div>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-cream sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[620px] sm:max-h-[calc(100vh-48px)] sm:w-[400px] sm:overflow-hidden sm:rounded-3xl sm:border sm:border-line sm:shadow-lift animate-fade-up">
          <header className="flex items-center gap-3 bg-weave px-4 py-3 text-ivory">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-round.png" alt="" className="size-10 rounded-full ring-1 ring-gold-400/50" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl font-semibold leading-tight">Gfive Assistant</p>
              <p className="flex items-center gap-1.5 text-[11px] text-ivory/70">
                <span className="size-1.5 rounded-full bg-[#25d366]" /> AI helper · replies instantly
              </p>
            </div>
            <a
              href={`https://wa.me/${settings.whatsappNumber}`}
              target="_blank"
              className="grid size-9 place-items-center rounded-full hover:bg-white/10"
              aria-label="Talk to a person on WhatsApp"
              title="Talk to a person on WhatsApp"
            >
              <MessageCircle size={18} />
            </a>
            <button onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-full hover:bg-white/10" aria-label="Close chat">
              <X size={20} />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] ${m.role === 'user' ? '' : 'w-full'}`}>
                  {m.content && (
                    <div
                      className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${
                        m.role === 'user'
                          ? 'rounded-br-md bg-leaf-700 text-ivory'
                          : m.error
                            ? 'rounded-bl-md border border-red-200 bg-red-50 text-red-800'
                            : 'rounded-bl-md border border-line bg-ivory text-ink'
                      }`}
                    >
                      {m.content}
                    </div>
                  )}
                  {!!m.designs?.length && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {m.designs.map((id) => {
                        const s = byId.get(id);
                        if (!s) return null;
                        return (
                          <Link
                            key={id}
                            href={`/s/${id}`}
                            onClick={() => window.innerWidth < 640 && setOpen(false)}
                            className="group overflow-hidden rounded-xl border border-line bg-ivory transition hover:border-gold-500"
                          >
                            <div className="aspect-[4/5] bg-sand">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={cldThumb(samplePhotos(s)[0], 300, 375)} alt="" className="size-full object-cover" />
                            </div>
                            <div className="p-2">
                              <p className="font-display text-base font-semibold leading-tight">#{s.designNumber}</p>
                              <p className="text-xs font-medium text-leaf-700">{inr(s.price)}/pc</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-line bg-ivory px-4 py-3">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="size-1.5 animate-bounce rounded-full bg-gold-500" style={{ animationDelay: `${d * 120}ms` }} />
                  ))}
                </div>
              </div>
            )}
            {fresh && (
              <div className="flex flex-wrap gap-2 pt-1">
                {(onProduct ? ['Is design ke baare mein batao', 'Which colours are available?', ...SUGGESTIONS.slice(2)] : SUGGESTIONS).map((s) => (
                  <button key={s} onClick={() => send(s)} className="chip">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-line bg-ivory p-3 pb-[max(env(safe-area-inset-bottom),12px)]"
          >
            <div className="flex items-end gap-2 rounded-2xl border border-line bg-white p-1.5 pl-3.5 focus-within:border-leaf-600">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                maxLength={800}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Ask about designs, colours, prices…"
                className="max-h-28 flex-1 resize-none bg-transparent py-2 text-[15px] text-ink outline-none placeholder:text-muted/70"
              />
              <button type="submit" disabled={busy || !input.trim()} className="grid size-10 shrink-0 place-items-center rounded-xl bg-leaf-700 text-ivory disabled:opacity-40" aria-label="Send">
                {busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted">AI can make mistakes. Confirm prices &amp; stock on WhatsApp.</p>
          </form>
        </div>
      )}
    </>
  );
}
