import { categoryName } from './categories';
import { canShareFiles, copyImageToClipboard, fetchImageFile, sharePhotosWithText, waTextUrl } from './wa-share';
import type { ColorDetail, Sample } from './types';

/** All main photos of a sample, de-duplicated, cover photo first. */
export function samplePhotos(s: Pick<Sample, 'imageUrl' | 'sampleImages'>): string[] {
  const list: string[] = [];
  if (s.imageUrl) list.push(s.imageUrl);
  if (Array.isArray(s.sampleImages)) list.push(...s.sampleImages);
  return Array.from(new Set(list.filter((u) => typeof u === 'string' && u.trim() !== '')));
}

/** Colours with optional photos (works for both new and old sample docs). */
export function sampleColors(s: Pick<Sample, 'colorDetails' | 'colors'>): ColorDetail[] {
  if (Array.isArray(s.colorDetails) && s.colorDetails.length > 0) {
    return s.colorDetails
      .filter((c) => c && c.name)
      .map((c) => ({ name: String(c.name), photoUrl: c.photoUrl || '' }));
  }
  return (s.colors || []).filter(Boolean).map((name) => ({ name, photoUrl: '' }));
}

/** Main photos + colour photos (used for the full-screen viewer). */
export function allSamplePhotos(s: Sample): string[] {
  const list = samplePhotos(s);
  sampleColors(s).forEach((c) => {
    if (c.photoUrl && !list.includes(c.photoUrl)) list.push(c.photoUrl);
  });
  return list;
}

/** Customer link for a design. `ref` = uid of the staff member sharing it, so the order is credited to them. */
export function sampleLink(id: string, ref?: string | null): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/s/${id}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;
}

export function sampleShareText(s: Sample, link: string, salesPerson?: string): string {
  // Same layout as the original GFive sample message
  return (
    `*Gfive -Kolkata*\n` +
    `*NEW UNSTITCHED SUIT SAMPLE*\n\n` +
    (categoryName(s.category) ? `*✦ DESIGN CATEGORY: ${categoryName(s.category).toUpperCase()} ✦*\n\n` : '') +
    `*Design No:* ${s.designNumber}\n` +
    `*Rate:* ₹${s.price}/pc\n` +
    (s.fabric ? `*Fabric:* ${s.fabric}\n` : '') +
    (s.work ? `*Work:* ${s.work}\n` : '') +
    (salesPerson ? `*Sales Person:* ${salesPerson}\n` : '') +
    `\n👇 *Click link to view details & place order:*\n${link}`
  );
}

/**
 * Sends the design PHOTO + details + link. Phone: share sheet (pick the customer's chat).
 * Computer: photo copied to clipboard + WhatsApp opens with the text (Ctrl+V adds the photo).
 * Returns what happened so the caller can tell the user.
 */
export async function shareSampleOnWhatsApp(s: Sample, ref?: string | null, salesPerson?: string): Promise<'shared' | 'cancelled' | 'copied' | 'text'> {
  const link = sampleLink(s.id, ref);
  const text = sampleShareText(s, link, salesPerson);
  const cover = samplePhotos(s)[0];
  const file = cover ? await fetchImageFile(cover, `Design_${s.designNumber}.jpg`) : null;
  if (file && canShareFiles()) {
    const r = await sharePhotosWithText([file], text);
    if (r !== 'failed') return r;
  }
  const copied = await copyImageToClipboard(file);
  window.open(waTextUrl(text), '_blank');
  if (copied) alert('Design photo copied. In WhatsApp, choose the customer, then press Ctrl+V to attach the photo and Send.');
  return copied ? 'copied' : 'text';
}
