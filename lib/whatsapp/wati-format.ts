/** WATI message formats (pure — used by the WATI adapter and tests). */
import type { Incoming } from './bot';

export type Interactive = {
  type: 'button' | 'list';
  header?: { type: string; text?: string; image?: { link: string } };
  body: { text: string };
  footer?: { text: string };
  action: { button?: string; buttons?: { reply: { id: string; title: string } }[]; sections?: { title: string; rows: { id: string; title: string; description?: string }[] }[] };
};


/** Same options as numbered text (fallback, and for the test). */
export function asText(i: Interactive): string {
  const opts =
    i.type === 'button'
      ? (i.action.buttons || []).map((b) => b.reply.title)
      : (i.action.sections || []).flatMap((s) => s.rows.map((r) => r.title + (r.description ? ` — ${r.description}` : '')));
  return [i.header?.text, i.body.text, '', ...opts.map((t, n) => `*${n + 1}.* ${t}`), '', '_Number likh kar bhejein (jaise 1)_'].filter((x) => x !== undefined).join('\n');
}

/** WATI "Message Received" webhook → the bot's Incoming message (null = ignore). */
export interface WatiEvent {
  eventType?: string;
  id?: string;
  whatsappMessageId?: string;
  waId?: string;
  senderName?: string;
  text?: string | null;
  type?: string;
  owner?: boolean;
  data?: string | null;
  listReply?: { title?: string; description?: string; id?: string } | null;
  buttonReply?: { text?: string; payload?: string } | null;
  interactiveButtonReply?: { title?: string; id?: string } | null;
}

export function watiToIncoming(e: WatiEvent): { msg: Incoming; name: string } | null {
  if (e.owner) return null; // sent by the business / an operator
  if (e.eventType && !/^message$/i.test(e.eventType) && !/newContactMessage/i.test(e.eventType)) return null;
  const from = String(e.waId || '').replace(/\D/g, '');
  const id = e.whatsappMessageId || e.id;
  if (!from || !id) return null;
  const base = { id, from };
  const name = e.senderName || '';
  const list = e.listReply;
  const btn = e.interactiveButtonReply || (e.buttonReply ? { title: e.buttonReply.text, id: e.buttonReply.payload } : null);
  if (list && (list.id || list.title)) return { msg: { ...base, type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: list.id || list.title || '', title: list.title || '' } } }, name };
  if (btn && (btn.id || btn.title)) return { msg: { ...base, type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: btn.id || btn.title || '', title: btn.title || '' } } }, name };
  const t = (e.type || 'text').toLowerCase();
  if (t === 'text' || t === 'button' || t === 'interactive') return { msg: { ...base, type: 'text', text: { body: String(e.text || '') } }, name };
  if (['image', 'video', 'document', 'audio', 'voice'].includes(t)) {
    const kind = t === 'voice' ? 'audio' : t;
    return { msg: { ...base, type: kind, [kind]: { id: String(e.data || ''), caption: String(e.text || '') } } as Incoming, name };
  }
  return { msg: { ...base, type: 'unsupported' } as Incoming, name };
}
