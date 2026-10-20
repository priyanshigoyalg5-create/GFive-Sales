import { categoryName } from './categories';
import { canShareFiles, copyImageToClipboard, fetchImageFile, sharePhotosWithText, waTextUrl } from './wa-share';
import type { Sample } from './types';

export { samplePhotos, sampleColors } from './sample-photos';
import { samplePhotos, sampleColors } from './sample-photos';

/** Main photos + colour photos (used for the full-screen viewer). */
/** True when this photo of the sample was created by AI (label it "AI generated"). */
export function isAiPhoto(s: Pick<Sample, 'aiImages'> | null | undefined, url: string): boolean {
  return !!s?.aiImages?.includes(url);
}

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
    (isAiPhoto(s, samplePhotos(s)[0] || '') ? `\n_Photo: AI generated model look_\n` : '') +
    (s.videoUrl ? `_Video: AI generated_\n` : '') +
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
    const files = [file];
    if (s.videoUrl) {
      try {
        const v = await (await fetch(s.videoUrl)).blob();
        const vf = new File([v], `Design_${s.designNumber}_AI.mp4`, { type: 'video/mp4' });
        if (navigator.canShare?.({ files: [file, vf] })) files.push(vf);
      } catch {
        /* send the photo only */
      }
    }
    const r = await sharePhotosWithText(files, text);
    if (r !== 'failed') return r;
  }
  const copied = await copyImageToClipboard(file);
  window.open(waTextUrl(text), '_blank');
  if (copied) alert('Design photo copied. In WhatsApp, choose the customer, then press Ctrl+V to attach the photo and Send.');
  return copied ? 'copied' : 'text';
}
