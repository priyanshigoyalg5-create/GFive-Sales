import { bearer, verifyJwUser } from '@/lib/server/verify-jw';
import { JW_PROMPTS } from '@/lib/jw-prompts';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Job Work app: read a bill / challan / job card photo with Gemini. The key stays on the server. */
export async function POST(req: Request) {
  const user = await verifyJwUser(bearer(req)).catch(() => null);
  if (!user) return Response.json({ error: 'Please login again (Job Work user only).' }, { status: 401 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: 'AI reading is not set up (GEMINI_API_KEY).' }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { image?: string; kind?: string };
  const prompt = JW_PROMPTS[body.kind || ''];
  if (!prompt || !body.image || !/^[A-Za-z0-9+/=]+$/.test(body.image) || body.image.length > 4_000_000) return Response.json({ error: 'Bad photo.' }, { status: 400 });
  // gemini-2.5-flash is closed to new projects (404) — use the current stable Flash, then the "latest" alias
  const models = [process.env.JW_AI_MODEL, 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-flash-latest'].filter((m, i, a): m is string => !!m && a.indexOf(m) === i);
  let r: Response | null = null;
  for (const model of models) {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: 'image/jpeg', data: body.image } }, { text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
    });
    if (r.status !== 404) break; // 404 = model not available for this key, try the next one
  }
  if (!r || !r.ok) {
    const detail = r ? ((await r.json().catch(() => ({}))) as { error?: { message?: string } }).error?.message || '' : '';
    console.error('jw ai-read', r?.status, detail);
    return Response.json({ error: `AI ${r?.status || ''} ${detail.slice(0, 120)}`.trim() }, { status: 502 });
  }
  const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  try {
    return Response.json({ data: JSON.parse(text.replace(/```json|```/g, '').trim()) });
  } catch {
    return Response.json({ error: 'AI answer was not readable.' }, { status: 502 });
  }
}
