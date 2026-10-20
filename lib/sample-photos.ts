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

