'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
  ImagePlus, X, Star, ChevronLeft, ChevronRight, Plus, Loader2, CheckCircle2, Copy, MessageCircle, ExternalLink, Sparkles, Clapperboard,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { useSamples } from '@/lib/hooks';
import { uploadImage } from '@/lib/upload';
import { cldThumb } from '@/lib/format';
import { sampleColors, samplePhotos, sampleLink, shareSampleOnWhatsApp } from '@/lib/samples';
import type { Sample } from '@/lib/types';
import { CATEGORIES, normCategory } from '@/lib/categories';
import AiStudio from './AiStudio';

interface Photo {
  id: string;
  url?: string; // already uploaded
  file?: File;
  preview: string;
  ai?: boolean; // made by AI → labelled "AI generated"
}
interface ColorRow {
  id: string;
  name: string;
  photo: Photo | null;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export default function SampleForm({ initial }: { initial?: Sample }) {
  const router = useRouter();
  const { profile } = useAuth();
  const { samples } = useSamples();
  const editing = !!initial;

  const [photos, setPhotos] = useState<Photo[]>(() =>
    initial ? samplePhotos(initial).map((u) => ({ id: uid(), url: u, preview: cldThumb(u, 400, 500), ai: !!initial.aiImages?.includes(u) })) : [],
  );
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl || '');
  const [ai, setAi] = useState<{ source: string } | null>(null);
  const [aiPrep, setAiPrep] = useState(false);
  const [designNumber, setDesignNumber] = useState(initial?.designNumber || '');
  const [price, setPrice] = useState(initial ? String(initial.price ?? '') : '');
  const [fabric, setFabric] = useState(initial?.fabric || '');
  const [work, setWork] = useState(initial?.work || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [category, setCategory] = useState<string>(normCategory(initial?.category));
  const [colors, setColors] = useState<ColorRow[]>(() =>
    initial && sampleColors(initial).length
      ? sampleColors(initial).map((c) => ({
          id: uid(),
          name: c.name,
          photo: c.photoUrl ? { id: uid(), url: c.photoUrl, preview: cldThumb(c.photoUrl, 120, 120) } : null,
        }))
      : [{ id: uid(), name: '', photo: null }],
  );
  const [quick, setQuick] = useState('');
  const [drag, setDrag] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<Sample | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fabrics = useMemo(() => Array.from(new Set(samples.map((s) => s.fabric).filter(Boolean))) as string[], [samples]);
  const works = useMemo(() => Array.from(new Set(samples.map((s) => s.work).filter(Boolean))) as string[], [samples]);
  const duplicate = useMemo(
    () =>
      designNumber.trim() &&
      samples.find((s) => !s.isTrashed && s.id !== initial?.id && String(s.designNumber).trim().toLowerCase() === designNumber.trim().toLowerCase()),
    [samples, designNumber, initial?.id],
  );

  // ---------------- photos
  const addFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    setPhotos((p) => [...p, ...list.map((f) => ({ id: uid(), file: f, preview: URL.createObjectURL(f) }))]);
    setErrors((e) => ({ ...e, photos: '' }));
  };
  const movePhoto = (i: number, d: number) =>
    setPhotos((p) => {
      const j = i + d;
      if (j < 0 || j >= p.length) return p;
      const c = [...p];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const makeCover = (i: number) => setPhotos((p) => [p[i], ...p.filter((_, k) => k !== i)]);

  // ---------------- AI model photo / video (works from the first ORIGINAL photo)
  const openAi = async () => {
    const idx = photos.findIndex((p) => !p.ai);
    if (idx < 0) {
      setErrors((e) => ({ ...e, photos: 'Add an original photo of the suit first' }));
      return;
    }
    const p = photos[idx];
    if (p.url) return setAi({ source: p.url });
    setAiPrep(true);
    try {
      const url = await uploadImage(p.file!);
      setPhotos((ps) => ps.map((x) => (x.id === p.id ? { ...x, url, file: undefined } : x)));
      setAi({ source: url });
    } catch (err) {
      setErrors((e) => ({ ...e, photos: (err as Error).message }));
    } finally {
      setAiPrep(false);
    }
  };
  const addAiPhoto = (url: string, asCover: boolean) =>
    setPhotos((ps) => {
      const item = { id: uid(), url, preview: cldThumb(url, 400, 500), ai: true };
      return asCover ? [item, ...ps] : [...ps, item];
    });

  // ---------------- colours
  const addQuickColors = () => {
    const names = quick.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    setColors((rows) => {
      const kept = rows.filter((r) => r.name.trim() || r.photo);
      const existing = new Set(kept.map((r) => r.name.trim().toLowerCase()));
      return [...kept, ...names.filter((n) => !existing.has(n.toLowerCase())).map((n) => ({ id: uid(), name: n, photo: null }))];
    });
    setQuick('');
  };

  // ---------------- save
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!photos.length) errs.photos = 'Add at least one sample photo';
    if (!designNumber.trim()) errs.designNumber = 'Required';
    if (!price || Number(price) <= 0) errs.price = 'Enter rate per piece';
    if (!normCategory(category)) errs.category = 'Please select a design category';
    if (!profile) errs.form = 'Please sign in again.';
    const validColors = colors.filter((c) => c.name.trim());
    if (!validColors.length) errs.colors = 'Add at least one colour';
    const names = validColors.map((c) => c.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) errs.colors = 'Two colours have the same name';
    setErrors(errs);
    if (Object.keys(errs).length) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      const toUpload = photos.filter((p) => !p.url).length + validColors.filter((c) => c.photo && !c.photo.url).length;
      let done = 0;
      const tick = () => setBusy(toUpload ? `Uploading photos ${++done}/${toUpload}…` : 'Saving…');
      setBusy(toUpload ? `Uploading photos 0/${toUpload}…` : 'Saving…');

      const photoUrls = await Promise.all(
        photos.map(async (p) => {
          if (p.url) return p.url;
          const u = await uploadImage(p.file!);
          tick();
          return u;
        }),
      );
      const colorDetails = await Promise.all(
        validColors.map(async (c) => {
          let photoUrl = c.photo?.url || '';
          if (c.photo && !c.photo.url && c.photo.file) {
            photoUrl = await uploadImage(c.photo.file);
            tick();
          }
          return { name: c.name.trim(), photoUrl };
        }),
      );
      setBusy('Saving…');

      const payload = {
        designNumber: designNumber.trim(),
        price: Number(price),
        fabric: fabric.trim(),
        work: work.trim(),
        description: description.trim(),
        category: normCategory(category),
        colors: colorDetails.map((c) => c.name),
        colorDetails,
        imageUrl: photoUrls[0],
        sampleImages: photoUrls,
        aiImages: photoUrls.filter((_, i) => photos[i].ai),
        videoUrl,
        updatedAt: serverTimestamp(),
      };

      let id = initial?.id;
      if (editing && id) {
        await updateDoc(doc(db, 'samples', id), payload);
      } else {
        // owner = the logged-in staff member (set automatically, never typed)
        const ref = await addDoc(collection(db, 'samples'), {
          ...payload,
          salesPerson: profile!.name, // legacy display field
          createdByUid: profile!.uid,
          createdByName: profile!.name,
          createdBy: profile!.email || '',
          isTrashed: false,
          createdAt: serverTimestamp(),
        });
        id = ref.id;
      }
      setSaved({ ...(initial || {}), ...payload, id: id!, createdAt: null, updatedAt: null } as Sample);
    } catch (err) {
      console.error(err);
      setErrors({ form: (err as Error).message || 'Could not save. Please try again.' });
    } finally {
      setBusy(null);
    }
  };

  const reset = () => {
    setPhotos([]);
    setVideoUrl('');
    setDesignNumber('');
    setPrice('');
    setDescription('');
    setColors([{ id: uid(), name: '', photo: null }]);
    setSaved(null);
    window.scrollTo({ top: 0 });
  };

  return (
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
      {/* ------------- photos */}
      <section className="card p-5 lg:self-start">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">Sample photos</h2>
          <span className="text-xs text-muted">{photos.length} added · first is cover</span>
        </div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            addFiles(e.dataTransfer.files);
          }}
          className={`mt-4 grid grid-cols-3 gap-3 rounded-2xl sm:grid-cols-4 ${drag ? 'ring-2 ring-gold-500 ring-offset-4 ring-offset-ivory' : ''}`}
        >
          {photos.map((p, i) => (
            <figure key={p.id}>
            <div className="group relative aspect-[4/5] overflow-hidden rounded-xl bg-sand ring-1 ring-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="" className="size-full object-cover" />
              {i === 0 && (
                <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-gold-500 px-2 py-0.5 text-[12px] font-semibold text-white">
                  <Star size={10} fill="currentColor" /> Cover
                </span>
              )}
              <button type="button" onClick={() => setPhotos((ps) => ps.filter((x) => x.id !== p.id))} className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/55 text-white" aria-label="Remove photo">
                <X size={14} />
              </button>
              <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
                <button type="button" onClick={() => movePhoto(i, -1)} disabled={i === 0} className="grid size-7 place-items-center rounded-full bg-white/85 text-ink disabled:opacity-0" aria-label="Move left">
                  <ChevronLeft size={15} />
                </button>
                {i !== 0 && (
                  <button type="button" onClick={() => makeCover(i)} className="rounded-full bg-white/85 px-2 text-[12px] font-medium text-ink">
                    Set cover
                  </button>
                )}
                <button type="button" onClick={() => movePhoto(i, 1)} disabled={i === photos.length - 1} className="grid size-7 place-items-center rounded-full bg-white/85 text-ink disabled:opacity-0" aria-label="Move right">
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
            <figcaption className={`mt-1 text-center text-xs font-medium ${p.ai ? 'text-gold-600' : 'text-muted'}`}>
              {p.ai ? 'AI generated' : 'Original'}
            </figcaption>
            </figure>
          ))}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex aspect-[4/5] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gold-500/50 bg-gold-50/60 text-gold-600 transition hover:border-gold-500 hover:bg-gold-50"
          >
            <ImagePlus size={24} />
            <span className="text-xs font-medium">Add photos</span>
            <span className="hidden text-[12px] text-muted sm:block">or drop here</span>
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        {errors.photos && <p className="mt-2 text-sm text-red-700">{errors.photos}</p>}
        <p className="mt-3 text-xs text-muted">Tip: select several photos at once. Big phone photos are compressed automatically before upload.</p>

        <div className="mt-4 rounded-2xl border border-gold-500/40 bg-gold-50/60 p-4">
          <p className="flex items-center gap-2 font-medium text-ink"><Sparkles size={16} className="text-gold-600" /> AI model photo &amp; video</p>
          <p className="mt-1 text-xs text-muted">Turn the original suit photo into a photo and a short video of a model wearing it. Marked “AI generated” everywhere.</p>
          <button type="button" className="btn btn-gold mt-3 w-full sm:w-auto" onClick={openAi} disabled={aiPrep || !photos.some((p) => !p.ai)}>
            {aiPrep ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Create with AI
          </button>
          {videoUrl && (
            <figure className="mt-3">
              <video src={videoUrl} controls playsInline className="max-h-72 rounded-xl bg-black" />
              <figcaption className="mt-1 flex items-center gap-3 text-xs font-medium text-gold-600">
                <span className="inline-flex items-center gap-1"><Clapperboard size={13} /> AI generated video</span>
                <button type="button" className="text-red-700 underline" onClick={() => setVideoUrl('')}>Remove</button>
              </figcaption>
            </figure>
          )}
        </div>
      </section>
      {ai && (
        <AiStudio
          sourceUrl={ai.source}
          designNumber={designNumber || 'new'}
          aiPhotos={photos.filter((p) => p.ai && p.url).map((p) => p.url!)}
          videoUrl={videoUrl || undefined}
          canSave
          onAddPhoto={addAiPhoto}
          onSaveVideo={(u) => setVideoUrl(u)}
          onClose={() => setAi(null)}
        />
      )}

      {/* ------------- details */}
      <div className="space-y-6">
        <section className="card space-y-4 p-5">
          <h2 className="font-display text-2xl font-semibold">Details</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="field-label">Design no. *</span>
              <input className="input" value={designNumber} onChange={(e) => setDesignNumber(e.target.value)} placeholder="e.g. SD11070" />
              {errors.designNumber && <span className="mt-1 block text-xs text-red-700">{errors.designNumber}</span>}
              {duplicate && <span className="mt-1 block text-xs text-amber-700">A design with this number already exists.</span>}
            </label>
            <label className="block">
              <span className="field-label">Rate (₹ / pc) *</span>
              <input className="input" type="number" inputMode="decimal" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1995" />
              {errors.price && <span className="mt-1 block text-xs text-red-700">{errors.price}</span>}
            </label>
            <label className="block">
              <span className="field-label">Fabric</span>
              <input className="input" list="fabric-list" value={fabric} onChange={(e) => setFabric(e.target.value)} placeholder="e.g. Raw silk" />
              <datalist id="fabric-list">{fabrics.map((f) => <option key={f} value={f} />)}</datalist>
            </label>
            <label className="block">
              <span className="field-label">Work</span>
              <input className="input" list="work-list" value={work} onChange={(e) => setWork(e.target.value)} placeholder="e.g. Katha" />
              <datalist id="work-list">{works.map((w) => <option key={w} value={w} />)}</datalist>
            </label>
          </div>
          <label className="block">
            <span className="field-label">Design category *</span>
            <select
              className={`input appearance-none ${errors.category ? '!border-red-600' : ''}`}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setErrors((x) => ({ ...x, category: '' }));
              }}
              required
            >
              <option value="" disabled>
                Select category…
              </option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.category && <span className="mt-1 block text-xs text-red-700">{errors.category}</span>}
          </label>
          <label className="block">
            <span className="field-label">Description (optional)</span>
            <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Dupatta, bottom, any extra details shown to customers" />
          </label>
          <p className="rounded-xl bg-sand/60 px-3.5 py-2.5 text-sm text-muted">
            Added by <span className="font-medium text-ink">{editing ? initial?.createdByName || initial?.salesPerson || '—' : profile?.name}</span>
            {!editing && ' (set automatically)'}
          </p>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold">Colours</h2>
            <span className="text-xs text-muted">{colors.filter((c) => c.name.trim()).length} colours</span>
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className="input"
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addQuickColors();
                }
              }}
              placeholder="Quick add: Red, Pink, Blue"
            />
            <button type="button" onClick={addQuickColors} className="btn btn-outline shrink-0">Add</button>
          </div>

          <ul className="mt-4 space-y-2.5">
            {colors.map((row) => (
              <li key={row.id} className="flex items-center gap-2.5">
                <input
                  className="input"
                  value={row.name}
                  onChange={(e) => setColors((cs) => cs.map((c) => (c.id === row.id ? { ...c, name: e.target.value } : c)))}
                  placeholder="Colour name (e.g. Rust, M1)"
                />
                <button
                  type="button"
                  onClick={() => setColors((cs) => (cs.length === 1 ? [{ id: uid(), name: '', photo: null }] : cs.filter((c) => c.id !== row.id)))}
                  className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-red-50 hover:text-red-700"
                  aria-label="Remove colour"
                >
                  <X size={17} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setColors((cs) => [...cs, { id: uid(), name: '', photo: null }])} className="btn btn-ghost btn-sm mt-3">
            <Plus size={15} /> Add colour row
          </button>
          {errors.colors && <p className="mt-2 text-sm text-red-700">{errors.colors}</p>}
        </section>

        {errors.form && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{errors.form}</p>}

        <div className="sticky bottom-20 z-10 flex gap-3 lg:bottom-4">
          <Link href="/admin/samples" className="btn btn-outline h-12">Cancel</Link>
          <button type="submit" disabled={!!busy} className="btn btn-primary h-12 flex-1">
            {busy ? <Loader2 size={18} className="animate-spin" /> : null}
            {busy || (editing ? 'Save changes' : 'Save & create link')}
          </button>
        </div>
      </div>

      {/* ------------- success */}
      {saved && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="card w-full max-w-sm p-6 text-center animate-fade-up">
            <CheckCircle2 className="mx-auto text-leaf-600" size={48} strokeWidth={1.5} />
            <h3 className="mt-3 font-display text-3xl font-semibold">{editing ? 'Changes saved' : 'Sample created'}</h3>
            <p className="mt-1 text-sm text-muted">Design #{saved.designNumber} is ready — share the link with customers.</p>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-sand/70 px-3 py-2 text-left text-xs text-ink">
              <span className="flex-1 truncate">{sampleLink(saved.id, profile?.uid)}</span>
            </div>
            <div className="mt-4 grid gap-2.5">
              <button type="button" className="btn btn-whatsapp h-12" onClick={() => shareSampleOnWhatsApp(saved, profile?.uid, profile?.name)}>
                <MessageCircle size={18} /> Share on WhatsApp
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(sampleLink(saved.id, profile?.uid));
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  }}
                >
                  <Copy size={15} /> {copied ? 'Copied!' : 'Copy link'}
                </button>
                <a href={sampleLink(saved.id, profile?.uid)} target="_blank" className="btn btn-outline">
                  <ExternalLink size={15} /> Open
                </a>
              </div>
              {editing ? (
                <button type="button" className="btn btn-ghost" onClick={() => router.push('/admin/samples')}>Back to samples</button>
              ) : (
                <button type="button" className="btn btn-ghost" onClick={reset}>Add another sample</button>
              )}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
