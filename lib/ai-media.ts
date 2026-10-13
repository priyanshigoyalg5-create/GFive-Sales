import 'server-only';
import { GoogleGenAI } from '@google/genai';

/**
 * AI model photos & videos for suit samples (server only).
 *
 *  • Photo: Google "Nano Banana" image model turns a photo of the unstitched
 *    suit into a catalogue photo of a model wearing it.
 *  • Video: Google Veo animates that model photo into a short 9:16 clip.
 *
 * Results are stored in the same Cloudinary account as the sample photos.
 * Needs GEMINI_API_KEY (Google AI Studio, billing enabled) on the server.
 */

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'jhddliu0';
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'textile_preset';
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image';
const VIDEO_MODEL = process.env.GEMINI_VIDEO_MODEL || 'veo-3.1-fast-generate-preview';
const API = 'https://generativelanguage.googleapis.com/v1beta';

export class AiError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

function apiKey(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new AiError('AI photos are not set up yet (GEMINI_API_KEY missing on Vercel).', 503);
  return k;
}

/** Only our own Cloudinary photos may be sent to the AI (no arbitrary URLs). */
export function isOwnCloudinaryImage(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith(`https://res.cloudinary.com/${CLOUD}/image/upload/`) && url.length < 600;
}

async function fetchAsBase64(url: string, maxSide: number): Promise<{ data: string; mimeType: string }> {
  // ask Cloudinary for a JPEG of sensible size
  const sized = url.replace('/image/upload/', `/image/upload/w_${maxSide},h_${maxSide},c_limit,f_jpg,q_90/`);
  const res = await fetch(sized, { cache: 'no-store' });
  if (!res.ok) throw new AiError('Could not read the sample photo.', 400);
  const buf = Buffer.from(await res.arrayBuffer());
  return { data: buf.toString('base64'), mimeType: 'image/jpeg' };
}

async function uploadToCloudinary(file: Blob, kind: 'image' | 'video'): Promise<string> {
  const body = new FormData();
  body.append('file', file);
  body.append('upload_preset', PRESET);
  body.append('tags', kind === 'image' ? 'ai_model_photo' : 'ai_model_video');
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/${kind}/upload`, { method: 'POST', body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url) {
    const msg = data?.error?.message || 'upload failed';
    throw new AiError(kind === 'video' ? `Could not save the video to Cloudinary (${msg}). Allow videos in the upload preset.` : `Could not save the photo (${msg}).`);
  }
  return data.secure_url as string;
}

// ------------------------------------------------------------------ photo

export const BACKGROUNDS = {
  studio: 'a plain soft-grey photo studio wall with soft window light',
  cream: 'an elegant warm cream and gold luxury boutique interior, softly blurred',
  haveli: 'a sunlit Rajasthani haveli courtyard with arches, softly blurred',
  garden: 'a lush green garden with soft natural daylight, softly blurred',
} as const;
export type Background = keyof typeof BACKGROUNDS;

function photoPrompt(bg: Background, notes: string): string {
  return [
    'The attached photo shows an UNSTITCHED Indian salwar suit fabric (kurta piece) as sold in a boutique.',
    'Create ONE photorealistic, full-length fashion catalogue photograph of an elegant Indian woman model (age 25–30) wearing this exact fabric stitched into a straight-cut, calf-length kurta with 3/4 sleeves, matching straight pants and a matching sheer dupatta draped over one shoulder.',
    'MOST IMPORTANT — keep the design exactly the same as the photo: the same fabric colour and shade, the same texture and sheerness, and the same embroidery / mirror work / motifs on the neckline and body, with the same pattern, thread colour, size and placement. Do not add new embroidery, do not change colours, do not simplify the work. Small scattered motifs on the fabric should appear on the kurta and dupatta the same way.',
    `Background: ${BACKGROUNDS[bg]}.`,
    'Model: standing naturally, relaxed graceful pose, facing the camera, soft smile, neat hair, natural makeup, small earrings only, modest styling. Whole outfit visible from head to toe, sharp focus on the embroidery, true-to-life colours, professional soft lighting.',
    'No text, no logo, no watermark, no extra people.',
    notes ? `Extra instructions from the boutique: ${notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Finds the first base64 image anywhere in the Interactions response. */
function findImage(node: unknown, depth = 0): { data: string; mime?: string } | null {
  if (!node || typeof node !== 'object' || depth > 8) return null;
  const o = node as Record<string, unknown>;
  if (o.type === 'image' && typeof o.data === 'string' && o.data.length > 100) return { data: o.data, mime: o.mime_type as string };
  const inline = (o.inlineData || o.inline_data) as Record<string, unknown> | undefined;
  if (inline && typeof inline.data === 'string') return { data: inline.data, mime: (inline.mimeType || inline.mime_type) as string };
  for (const v of Object.values(o)) {
    const hit = findImage(v, depth + 1);
    if (hit) return hit;
  }
  return null;
}

export async function generateModelPhoto(sourceUrl: string, opts: { background?: Background; notes?: string } = {}): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: apiKey() });
  const img = await fetchAsBase64(sourceUrl, 2048);
  const bg: Background = opts.background && opts.background in BACKGROUNDS ? opts.background : 'studio';
  const notes = (opts.notes || '').replace(/\s+/g, ' ').trim().slice(0, 300);

  let res: unknown;
  try {
    res = await ai.interactions.create({
      model: IMAGE_MODEL,
      input: [
        { type: 'text', text: photoPrompt(bg, notes) },
        { type: 'image', mime_type: img.mimeType, data: img.data },
      ],
      response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: '3:4', image_size: '2K' },
    } as Parameters<typeof ai.interactions.create>[0]);
  } catch (err) {
    console.error('AI photo error', err);
    const m = (err as Error)?.message || '';
    if (/quota|billing|429/i.test(m)) throw new AiError('Google AI limit / billing issue — check billing in Google AI Studio.', 429);
    if (/safety|blocked/i.test(m)) throw new AiError('Google AI refused this photo. Try another photo of the design.', 422);
    throw new AiError('AI could not create the photo right now. Please try again.');
  }
  const out = (res as { output_image?: { data?: string; mime_type?: string } }).output_image;
  const found = out?.data ? { data: out.data, mime: out.mime_type } : findImage(res);
  if (!found) throw new AiError('AI did not return a photo. Please try again (or try another photo).');
  const blob = new Blob([Buffer.from(found.data, 'base64')], { type: found.mime || 'image/jpeg' });
  return uploadToCloudinary(blob, 'image');
}

// ------------------------------------------------------------------ video

const VIDEO_PROMPT = [
  'Elegant fashion catalogue video of this exact model and outfit, in the same place and light as the photo.',
  'She stands gracefully, smiles, then the camera slowly pushes in to show the neckline embroidery up close, then pulls back as she gently lifts the dupatta and lets it flow, turning slightly to show the side of the kurta.',
  'Smooth slow camera movement, natural realistic motion, soft studio lighting, soft instrumental Indian music.',
  'Keep the outfit EXACTLY as in the photo — same colour, same embroidery and mirror work, same fabric. No text, no logo, no other people.',
].join(' ');

/** Starts a Veo job. Returns the operation name to poll. */
export async function startModelVideo(photoUrl: string): Promise<string> {
  const key = apiKey();
  const img = await fetchAsBase64(photoUrl, 1600);
  const res = await fetch(`${API}/models/${VIDEO_MODEL}:predictLongRunning`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt: VIDEO_PROMPT, image: { inlineData: { mimeType: img.mimeType, data: img.data } } }],
      parameters: { aspectRatio: '9:16', durationSeconds: '8', resolution: '720p', personGeneration: 'allow_adult' },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.name) {
    console.error('Veo start error', res.status, data);
    if (res.status === 429) throw new AiError('Google AI limit / billing issue — check billing in Google AI Studio.', 429);
    throw new AiError(data?.error?.message ? `Video could not start: ${data.error.message}` : 'Video could not start. Please try again.');
  }
  return data.name as string;
}

export function isVideoOperation(op: unknown): op is string {
  return typeof op === 'string' && /^models\/[a-z0-9.-]+\/operations\/[A-Za-z0-9_-]+$/.test(op);
}

/** Checks a Veo job; when finished, saves the clip to Cloudinary and returns its URL. */
export async function checkModelVideo(op: string): Promise<{ done: false } | { done: true; url: string }> {
  const key = apiKey();
  const res = await fetch(`${API}/${op}`, { headers: { 'x-goog-api-key': key }, cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AiError(data?.error?.message || 'Could not check the video.');
  if (!data.done) return { done: false };
  if (data.error) throw new AiError(`Video failed: ${data.error.message || 'unknown error'}`);
  const vr = data.response?.generateVideoResponse;
  const uri: string | undefined = vr?.generatedSamples?.[0]?.video?.uri;
  if (!uri) {
    const why = vr?.raiMediaFilteredReasons?.[0];
    throw new AiError(why ? `Google AI blocked this video: ${why}` : 'AI did not return a video. Please try again.', 422);
  }
  const host = new URL(uri).hostname;
  if (!host.endsWith('googleapis.com')) throw new AiError('Unexpected video location.');
  const vid = await fetch(uri, { headers: { 'x-goog-api-key': key }, redirect: 'follow' });
  if (!vid.ok) throw new AiError('Could not download the video from Google.');
  const blob = new Blob([await vid.arrayBuffer()], { type: 'video/mp4' });
  return { done: true, url: await uploadToCloudinary(blob, 'video') };
}
