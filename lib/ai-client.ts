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

/** Starts the video and waits for it (checks every 10 s, gives up after ~7 min). */
export async function aiModelVideo(user: User, imageUrl: string, onTick?: (secs: number) => void, signal?: AbortSignal): Promise<string> {
  const { op } = await call<{ op: string }>(user, '/api/ai/model-video', { method: 'POST', body: JSON.stringify({ imageUrl }) });
  const started = Date.now();
  while (Date.now() - started < 7 * 60_000) {
    for (let i = 0; i < 10; i++) {
      if (signal?.aborted) throw new Error('Stopped');
      await new Promise((r) => setTimeout(r, 1000));
      onTick?.(Math.round((Date.now() - started) / 1000));
    }
    const r = await call<{ done: boolean; url?: string }>(user, `/api/ai/model-video?op=${encodeURIComponent(op)}`);
    if (r.done && r.url) return r.url;
  }
  throw new Error('The video is taking too long. Please try again.');
}
