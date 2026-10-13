import { categoryName } from './categories';
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

/** Tries native share with the cover photo; falls back to a WhatsApp text link. */
export async function shareSampleOnWhatsApp(s: Sample, ref?: string | null, salesPerson?: string): Promise<void> {
  const link = sampleLink(s.id, ref);
  const text = sampleShareText(s, link, salesPerson);
  const cover = samplePhotos(s)[0];
  if (typeof navigator !== 'undefined' && navigator.share && cover) {
    try {
      const res = await fetch(cover);
      const blob = await res.blob();
      const file = new File([blob], `Design_${s.designNumber}.jpg`, { type: blob.type || 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ text, files: [file] });
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return; // user closed the sheet
    }
  }
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}
