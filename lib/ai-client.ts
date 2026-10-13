'use client';

import type { User } from 'firebase/auth';

export type AiBackground = 'studio' | 'cream' | 'haveli' | 'garden';

export const AI_BACKGROUNDS: { id: AiBackground; label: string }[] = [
  { id: 'studio', label: 'Studio' },
  { id: 'cream', label: 'Boutique' },
  { id: 'haveli', label: 'Haveli' },
  { id: 'garden', label: 'Garden' },
];

async function call<T>(user: User, url: string, init: RequestInit = {}): Promise<T> {
  const token = await user.getIdToken();
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'AI is unavailable right now. Please try again.');
  return data as T;
}

export async function aiModelPhoto(user: User, imageUrl: string, background: AiBackground, notes: string): Promise<string> {
  const r = await call<{ url: string }>(user, '/api/ai/model-photo', { method: 'POST', body: JSON.stringify({ imageUrl, background, notes }) });
  return r.url;
}

/**
 * Starts the video and waits for it (checks every 10 s, gives up after ~12 min).
 * `long` = 15 s: the 8 s clip is extended once by Google before it is saved.
 */
export async function aiModelVideo(
  user: User,
  imageUrl: string,
  opts: { long?: boolean; onTick?: (secs: number, stage: 'first' | 'extending') => void; signal?: AbortSignal } = {},
): Promise<{ url: string; extended: boolean }> {
  let { op } = await call<{ op: string }>(user, '/api/ai/model-video', { method: 'POST', body: JSON.stringify({ imageUrl }) });
  let extend = !!opts.long;
  let stage: 'first' | 'extending' = 'first';
  const started = Date.now();
  while (Date.now() - started < 12 * 60_000) {
    for (let i = 0; i < 10; i++) {
      if (opts.signal?.aborted) throw new Error('Stopped');
      await new Promise((r) => setTimeout(r, 1000));
      opts.onTick?.(Math.round((Date.now() - started) / 1000), stage);
    }
    const r = await call<{ done: boolean; url?: string; op?: string; extended?: boolean }>(
      user,
      `/api/ai/model-video?op=${encodeURIComponent(op)}${extend ? '&extend=1' : ''}`,
    );
    if (r.done && r.url) return { url: r.url, extended: !!r.extended && !!opts.long };
    if (r.op) {
      op = r.op; // the extension job
      extend = false;
      stage = 'extending';
    }
  }
  throw new Error('The video is taking too long. Please try again.');
}
