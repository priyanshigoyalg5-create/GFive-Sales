import Anthropic from '@anthropic-ai/sdk';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/collections';
import { DEFAULT_SETTINGS } from '@/lib/settings-defaults';
import type { CompanySettings, Sample } from '@/lib/types';

export const maxDuration = 30;

const MODEL = process.env.CHAT_MODEL || 'claude-haiku-5-5';
const MAX_TURNS = 12;
const MAX_CHARS = 800;

// ------------------------------------------------------------ catalogue cache
let cache: { at: number; text: string; ids: Set<string> } | null = null;

async function catalogue() {
  if (cache && Date.now() - cache.at < 60_000) return cache;
  const [snap, setSnap] = await Promise.all([getDocs(collection(db, 'samples')), getDoc(doc(db, 'settings', 'company')).catch(() => null)]);
  const s: CompanySettings = { ...DEFAULT_SETTINGS, ...((setSnap?.exists() ? setSnap.data() : {}) as Partial<CompanySettings>) };
  const ids = new Set<string>();
  const rows = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Sample, 'id'>) }))
    .filter((x) => !x.isTrashed)
    .map((x) => {
      ids.add(x.id);
      const colours = (x.colorDetails?.length ? x.colorDetails.map((c) => c.name) : x.colors || []).join(', ');
      const coll = COLLECTIONS.find((c) => c.id === x.collection)?.name || '-';
      return `id=${x.id} | design=${x.designNumber} | ₹${x.price}/pc | collection=${coll} | fabric=${x.fabric || '-'} | work=${x.work || '-'} | colours=${colours || '-'}${x.description ? ` | note=${x.description.slice(0, 160)}` : ''}`;
    });

  const text = `BUSINESS
${s.companyName} (brand: Gfive — "Glamour Grace Unlimited"), Kolkata. #1 in Kolkata karigari unstitched suits.
Address: ${s.addressLine}. Store phone: ${s.storePhone}. WhatsApp orders: +${s.whatsappNumber}. Email: ${s.email}. Retail website: ${s.website}. Instagram: @${s.instagram}. GSTIN: ${s.gstin}.
This website is Gfive's trade / wholesale ordering desk for boutiques, retailers and agents. Prices are per piece.

COLLECTIONS
${COLLECTIONS.map((c) => `- ${c.name}: ${c.tagline} (typically ${c.range})`).join('\n')}

HOW TO ORDER ON THIS SITE
1. Open a design and set pieces for each colour with + / −.
2. Tap "Add to cart" (to add more designs) or "Order now".
3. In the cart enter firm name, mobile, city (GST no., agent and remarks are optional) and tap "Place order on WhatsApp". The order is saved and a WhatsApp message with the order number opens.
Firm details are remembered on the customer's phone for next time.

LIVE CATALOGUE (${rows.length} designs)
${rows.join('\n') || '(no designs uploaded yet)'}`;

  cache = { at: Date.now(), text, ids };
  return cache;
}

const RULES = `You are "Gfive Assistant", the friendly shopping assistant on Gfive's trade ordering website.

Style:
- Reply in the customer's language and script: English, Hindi, Hinglish (Roman Hindi) or Bengali. Match their tone; be warm and brief (2–5 short sentences). Use simple words.
- Plain text only. No markdown headings, tables or bold. Short "•" lists are fine.

Recommending designs:
- Only recommend designs that are in the LIVE CATALOGUE. Never invent design numbers, prices, colours, stock, fabrics or discounts.
- To show a design, put its token on its own line exactly like: [[design:THE_ID]] — the website turns it into a photo card with a link. Show at most 4.
- If nothing matches, say so honestly and suggest the closest options or contacting the team.

Things you don't know (say so and point to WhatsApp/phone): live stock, delivery dates, discounts or negotiated rates, minimum order quantity, payment terms, shipping charges, order status, returns. Never promise any of these.
Never ask for payment details. Don't discuss anything unrelated to Gfive and its products; politely steer back.
If the customer wants to talk to a person, give the WhatsApp number and store phone.`;

// ------------------------------------------------------------ naive rate limit
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 12;
}

type Msg = { role: 'user' | 'assistant'; content: string };

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'Chat is not configured yet.' }, { status: 503 });
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  if (limited(ip)) return Response.json({ error: 'Too many messages — please wait a minute.' }, { status: 429 });

  let body: { messages?: Msg[]; context?: { designId?: string } };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Bad request' }, { status: 400 });
  }

  const messages = (body.messages || [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return Response.json({ error: 'Bad request' }, { status: 400 });
  }

  try {
    const cat = await catalogue();
    const ctx = body.context?.designId && cat.ids.has(body.context.designId)
      ? `\nThe customer is currently looking at design id=${body.context.designId}.`
      : '';
    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: [
        { type: 'text', text: RULES },
        { type: 'text', text: cat.text, cache_control: { type: 'ephemeral' } },
        ...(ctx ? [{ type: 'text' as const, text: ctx }] : []),
      ],
      messages,
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    // keep only design tokens that really exist
    const designs = Array.from(new Set(Array.from(text.matchAll(/\[\[design:([A-Za-z0-9_-]+)\]\]/g)).map((m) => m[1]))).filter((id) => cat.ids.has(id)).slice(0, 4);
    const reply = text.replace(/\[\[design:[^\]]*\]\]/g, '').replace(/\n{3,}/g, '\n\n').trim();
    return Response.json({ reply, designs });
  } catch (err) {
    console.error('chat error', err);
    return Response.json({ error: 'Assistant is unavailable right now. Please message us on WhatsApp.' }, { status: 502 });
  }
}

export async function GET() {
  return Response.json({ enabled: !!process.env.ANTHROPIC_API_KEY });
}
