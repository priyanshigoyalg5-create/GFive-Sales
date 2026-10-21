'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { CheckCircle2, Loader2, Megaphone, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { cldThumb } from '@/lib/format';
import { samplePhotos } from '@/lib/sample-photos';
import { postCaption } from '@/lib/social/handler';
import { useSettings } from '@/lib/settings';
import type { Sample } from '@/lib/types';

/** Samples → "Post": publish a design photo with caption on Instagram and/or Facebook. */
export default function PostToSocial({ sample, onClose }: { sample: Sample; onClose: () => void }) {
  const { state } = useAuth();
  const settings = useSettings();
  const photos = samplePhotos(sample);
  const [photo, setPhoto] = useState(photos[0] || '');
  const [ig, setIg] = useState(true);
  const [fb, setFb] = useState(true);
  const [caption, setCaption] = useState(() => postCaption(sample, { showRate: false, siteUrl: '', company: 'GFive Kolkata' }));
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ instagram?: string; facebook?: string; errors: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // use the "show rate" choice from Settings when this person can read it
  useEffect(() => {
    getDoc(doc(db, 'config', 'social'))
      .then((s) => {
        if (s.data()?.showRate) setCaption(postCaption(sample, { showRate: true, siteUrl: '', company: settings.companyName || 'GFive Kolkata' }));
      })
      .catch(() => {});
  }, [sample, settings.companyName]);

  const post = async () => {
    if (state.status !== 'ready') return;
    setBusy(true);
    setErr(null);
    try {
      const t = await state.user.getIdToken();
      const r = await fetch('/api/social/post', {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleId: sample.id, photo, instagram: ig, facebook: fb, caption }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok && !data.errors) throw new Error(data.error || 'Could not post.');
      setRes(data);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black/55 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6" onClick={busy ? undefined : onClose}>
      <div role="dialog" aria-modal="true" aria-label="Post to Instagram and Facebook" className="mt-auto flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl bg-cream shadow-lift sm:mt-0 sm:max-w-2xl sm:rounded-3xl animate-fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line bg-ivory px-5 py-3">
          <p className="flex items-center gap-2 font-display text-xl font-semibold"><Megaphone size={18} className="text-gold-600" /> Post #{sample.designNumber}</p>
          <button type="button" onClick={onClose} disabled={busy} className="grid size-9 place-items-center rounded-full hover:bg-sand" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="space-y-4 overflow-y-auto p-5">
          <div>
            <span className="field-label">Photo</span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.map((p) => (
                <button key={p} type="button" onClick={() => setPhoto(p)} aria-pressed={photo === p} className={`w-20 shrink-0 text-center ${photo === p ? '' : 'opacity-60'}`}>
                  <span className={`block h-24 w-20 overflow-hidden rounded-lg border-2 ${photo === p ? 'border-gold-500' : 'border-transparent'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cldThumb(p, 160, 200)} alt="" className="size-full object-cover" />
                  </span>
                  <span className="mt-0.5 block text-[12px] text-muted">{sample.aiImages?.includes(p) ? 'AI generated' : 'Original'}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-leaf-700" checked={ig} onChange={(e) => setIg(e.target.checked)} /> Instagram @gfiveindia</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-leaf-700" checked={fb} onChange={(e) => setFb(e.target.checked)} /> Facebook page</label>
          </div>
          <label className="block">
            <span className="field-label">Caption</span>
            <textarea className="input" rows={9} value={caption} onChange={(e) => setCaption(e.target.value)} />
          </label>
          {res && (
            <div className="rounded-xl bg-leaf-50 p-3 text-sm text-leaf-800">
              {res.instagram && <p className="flex items-center gap-1.5"><CheckCircle2 size={15} /> Posted on Instagram</p>}
              {res.facebook && <p className="flex items-center gap-1.5"><CheckCircle2 size={15} /> Posted on Facebook</p>}
              {res.errors.map((e) => <p key={e} className="text-red-800">{e}</p>)}
              <p className="mt-1 text-xs text-muted">Comments like “price” on this post will get an automatic DM with this design.</p>
            </div>
          )}
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
          <button type="button" className="btn btn-primary h-11 w-full" onClick={post} disabled={busy || (!ig && !fb) || !photo || !!res}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Megaphone size={16} />} {res ? 'Posted' : 'Post now'}
          </button>
        </div>
      </div>
    </div>
  );
}
