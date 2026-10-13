'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Loader2, ImagePlus, Star, RefreshCw, Download, Clapperboard, MessageCircle, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AI_BACKGROUNDS, aiModelPhoto, aiModelVideo, type AiBackground } from '@/lib/ai-client';
import { cldThumb } from '@/lib/format';

/**
 * "AI Model Studio": turns the original suit photo into a model photo and an
 * 8-second model video. Every AI result is clearly labelled "AI generated".
 */
export default function AiStudio({
  sourceUrl,
  designNumber,
  aiPhotos = [],
  videoUrl: savedVideo,
  canSave,
  onAddPhoto,
  onSaveVideo,
  onClose,
}: {
  sourceUrl: string; // original photo (Cloudinary)
  designNumber: string;
  aiPhotos?: string[]; // AI photos already on the sample
  videoUrl?: string;
  canSave: boolean; // owner / Super Admin can add results to the sample
  onAddPhoto?: (url: string, asCover: boolean) => Promise<void> | void;
  onSaveVideo?: (url: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const { state } = useAuth();
  const user = state.status === 'ready' ? state.user : null;

  const [bg, setBg] = useState<AiBackground>('studio');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | null>(aiPhotos[0] || null);
  const [added, setAdded] = useState<string[]>(aiPhotos);
  const [busy, setBusy] = useState<'photo' | 'video' | 'save' | null>(null);
  const [secs, setSecs] = useState(0);
  const long = false; // 8 s clips (the 15 s Veo extension is kept in code but switched off)
  const [stage, setStage] = useState<'first' | 'extending'>('first');
  const [note, setNote] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(savedVideo || null);
  const [videoSaved, setVideoSaved] = useState(!!savedVideo);
  const [err, setErr] = useState<string | null>(null);
  const stop = useRef<AbortController | null>(null);

  useEffect(() => () => stop.current?.abort(), []);

  const makePhoto = async () => {
    if (!user) return;
    setErr(null);
    setBusy('photo');
    const t0 = Date.now();
    const timer = setInterval(() => setSecs(Math.round((Date.now() - t0) / 1000)), 1000);
    try {
      setPhoto(await aiModelPhoto(user, sourceUrl, bg, notes));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      clearInterval(timer);
      setBusy(null);
    }
  };

  const makeVideo = async () => {
    if (!user || !photo) return;
    setErr(null);
    setBusy('video');
    setSecs(0);
    stop.current = new AbortController();
    try {
      setStage('first');
      setNote(null);
      const { url, extended } = await aiModelVideo(user, photo, {
        long,
        signal: stop.current.signal,
        onTick: (t, st) => {
          setSecs(t);
          setStage(st);
        },
      });
      setVideo(url);
      if (long && !extended) setNote('Google could not make it longer this time, so this is the 8-second video.');
      setVideoSaved(false);
    } catch (e) {
      if ((e as Error).message !== 'Stopped') setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const addPhoto = async (asCover: boolean) => {
    if (!photo || !onAddPhoto) return;
    setBusy('save');
    try {
      await onAddPhoto(photo, asCover);
      setAdded((a) => (a.includes(photo) ? a : [...a, photo]));
    } catch (e) {
      setErr((e as Error).message || 'Could not add the photo.');
    } finally {
      setBusy(null);
    }
  };

  const saveVideo = async () => {
    if (!video || !onSaveVideo) return;
    setBusy('save');
    try {
      await onSaveVideo(video);
      setVideoSaved(true);
    } catch (e) {
      setErr((e as Error).message || 'Could not save the video.');
    } finally {
      setBusy(null);
    }
  };

  const photoAdded = !!photo && added.includes(photo);

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black/55 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6" onClick={busy ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AI model studio"
        className="mt-auto flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl bg-cream shadow-lift sm:mt-0 sm:max-w-3xl sm:rounded-3xl animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line bg-ivory px-5 py-3">
          <div>
            <p className="flex items-center gap-2 font-display text-xl font-semibold leading-tight">
              <Sparkles size={18} className="text-gold-600" /> AI model photo &amp; video
            </p>
            <p className="text-xs text-muted">Design #{designNumber} · AI results are always marked “AI generated”</p>
          </div>
          <button type="button" onClick={onClose} disabled={!!busy} className="grid size-9 place-items-center rounded-full hover:bg-sand disabled:opacity-40" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {/* before / after */}
          <div className="grid grid-cols-2 gap-3">
            <figure>
              <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-sand ring-1 ring-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cldThumb(sourceUrl, 600, 800)} alt={`Original photo of design ${designNumber}`} className="size-full object-cover" />
              </div>
              <figcaption className="mt-1.5 text-center text-sm font-medium text-ink">Original</figcaption>
            </figure>
            <figure>
              <div className="relative grid aspect-[3/4] place-items-center overflow-hidden rounded-2xl bg-sand ring-1 ring-line">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cldThumb(photo, 600, 800)} alt={`AI generated model photo of design ${designNumber}`} className={`size-full object-cover ${busy === 'photo' ? 'opacity-40' : ''}`} />
                ) : (
                  <Sparkles size={34} className="text-gold-500/60" />
                )}
                {busy === 'photo' && (
                  <div className="absolute inset-0 grid place-items-center text-center text-sm text-leaf-800">
                    <div>
                      <Loader2 className="mx-auto animate-spin" />
                      <p className="mt-2 font-medium">Creating… {secs}s</p>
                      <p className="text-xs text-muted">usually 20–60 seconds</p>
                    </div>
                  </div>
                )}
              </div>
              <figcaption className="mt-1.5 text-center text-sm font-medium text-gold-600">AI generated</figcaption>
            </figure>
          </div>

          {/* options */}
          <div className="card space-y-3 p-4">
            <div>
              <span className="field-label">Background</span>
              <div className="flex flex-wrap gap-2">
                {AI_BACKGROUNDS.map((b) => (
                  <button key={b.id} type="button" onClick={() => setBg(b.id)} className={`chip ${bg === b.id ? 'chip-active' : ''}`} aria-pressed={bg === b.id}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="field-label">Extra instructions (optional)</span>
              <input className="input" value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. dupatta on both shoulders, model with open hair" />
            </label>
            <button type="button" className="btn btn-gold h-11 w-full" onClick={makePhoto} disabled={!!busy || !user}>
              {busy === 'photo' ? <Loader2 size={16} className="animate-spin" /> : photo ? <RefreshCw size={16} /> : <Sparkles size={16} />}
              {photo ? 'Make another model photo' : 'Create model photo'}
            </button>
            <p className="text-center text-xs text-muted">About ₹12 per photo (Google AI). Try again if the work does not match exactly.</p>
          </div>

          {photo && (
            <div className="flex flex-wrap gap-2">
              {canSave && onAddPhoto && (
                photoAdded ? (
                  <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-leaf-50 px-4 text-sm text-leaf-800"><Check size={15} /> Added to sample photos</span>
                ) : (
                  <>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => addPhoto(false)} disabled={!!busy}><ImagePlus size={15} /> Add to photos</button>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => addPhoto(true)} disabled={!!busy}><Star size={15} /> Add as cover</button>
                  </>
                )
              )}
              <a className="btn btn-sm btn-outline" href={photo.replace('/upload/', '/upload/fl_attachment/')} download>
                <Download size={15} /> Download
              </a>
              <ShareFile url={photo} name={`GFive_${designNumber}_AI.jpg`} type="image/jpeg" text={`Design #${designNumber} — AI generated model look`} />
            </div>
          )}

          {/* video */}
          <div className="card space-y-3 p-4">
            <p className="flex items-center gap-2 font-display text-xl font-semibold"><Clapperboard size={18} className="text-gold-600" /> Model video (8 sec)</p>
            {video ? (
              <figure>
                <video src={video} controls playsInline className="mx-auto max-h-[60vh] rounded-2xl bg-black" />
                <figcaption className="mt-1.5 text-center text-sm font-medium text-gold-600">AI generated video</figcaption>
              </figure>
            ) : (
              <p className="text-sm text-muted">{photo ? 'Made from the AI model photo above.' : 'First create a model photo — the video starts from it.'}</p>
            )}
            {busy === 'video' ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-leaf-50 px-4 py-3 text-sm text-leaf-800">
                <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> {stage === 'first' ? 'Making video…' : 'Making it longer (part 2)…'} {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')} ({long ? '3–6 min' : '1–3 min'})</span>
                <button type="button" className="text-xs underline" onClick={() => stop.current?.abort()}>Stop</button>
              </div>
            ) : (
              <button type="button" className="btn btn-primary h-11 w-full" onClick={makeVideo} disabled={!photo || !!busy || !user}>
                <Clapperboard size={16} /> {video ? 'Make a new video' : 'Create video'}
              </button>
            )}
            <p className="text-center text-xs text-muted">{long ? 'About ₹140 for 15 sec' : 'About ₹70 for 8 sec'} (Google Veo). Keep this window open while it is made.</p>
            {note && <p className="rounded-lg bg-gold-50 px-3 py-2 text-center text-xs text-gold-600">{note}</p>}
            {video && busy !== 'video' && (
              <div className="flex flex-wrap gap-2">
                {canSave && onSaveVideo && (videoSaved ? (
                  <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-leaf-50 px-4 text-sm text-leaf-800"><Check size={15} /> Saved to sample</span>
                ) : (
                  <button type="button" className="btn btn-sm btn-primary" onClick={saveVideo} disabled={!!busy}><Check size={15} /> Save to sample</button>
                ))}
                <a className="btn btn-sm btn-outline" href={video.replace('/upload/', '/upload/fl_attachment/')} download>
                  <Download size={15} /> Download
                </a>
                <ShareFile url={video} name={`GFive_${designNumber}_AI.mp4`} type="video/mp4" text={`Design #${designNumber} — AI generated model video`} />
              </div>
            )}
          </div>

          {!canSave && <p className="text-center text-xs text-muted">Only the person who added this sample (or the Super Admin) can save AI results to it. You can still download or share them.</p>}
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
        </div>
      </div>
    </div>
  );
}

/** Share an AI photo/video through the phone's share sheet (WhatsApp). */
function ShareFile({ url, name, type, text }: { url: string; name: string; type: string; text: string }) {
  const [busy, setBusy] = useState(false);
  const share = async () => {
    setBusy(true);
    try {
      const b = await (await fetch(url)).blob();
      const file = new File([b], name, { type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else {
        // computer: download it, then attach in WhatsApp Web
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        alert('Saved to your computer — attach it in WhatsApp.');
      }
    } catch {
      /* cancelled */
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className="btn btn-sm btn-whatsapp" onClick={share} disabled={busy}>
      {busy ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />} Share on WhatsApp
    </button>
  );
}
