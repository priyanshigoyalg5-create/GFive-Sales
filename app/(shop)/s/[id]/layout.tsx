import type { Metadata } from 'next';
import { cache } from 'react';
import { doc, getDoc, getFirestore } from 'firebase/firestore/lite';
import { app } from '@/lib/firebase-app';
import { cldThumb } from '@/lib/format';

const db = getFirestore(app);

type SampleMeta = { designNumber?: string; price?: number; fabric?: string; work?: string; imageUrl?: string; sampleImages?: string[]; isTrashed?: boolean };

/** One read per request, shared by the metadata and the layout below. */
const loadSample = cache(async (id: string): Promise<SampleMeta | null> => {
  try {
    const snap = await getDoc(doc(db, 'samples', id));
    return snap.exists() ? (snap.data() as SampleMeta) : null;
  } catch {
    return null;
  }
});

/** Gives each design link a WhatsApp/Facebook preview with its photo and price. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const s = await loadSample(id);
    if (!s) return { title: 'Design' };
    const img = s.imageUrl || s.sampleImages?.[0];
    const title = `Design #${s.designNumber} — ₹${s.price}/pc`;
    const description = [s.fabric, s.work].filter(Boolean).join(' · ') || 'GFive designer unstitched suit';
    return {
      title,
      description,
      openGraph: {
        title: `GFive · ${title}`,
        description: `${description}. Tap to view all colours and place your order.`,
        // 1200×630 landscape → WhatsApp shows a big photo inside the message bubble.
        // The suit photo is padded (not cropped) on a cream background.
        images: img
          ? [{ url: img.replace('/upload/', '/upload/w_1200,h_630,c_pad,b_rgb:fbf5e9,q_80,f_jpg/'), width: 1200, height: 630, alt: title }]
          : undefined,
        type: 'website',
        siteName: 'GFive Kolkata',
      },
      twitter: { card: 'summary_large_image', title: `GFive · ${title}`, images: img ? [img.replace('/upload/', '/upload/w_1200,h_630,c_pad,b_rgb:fbf5e9,q_80,f_jpg/')] : undefined },
    };
  } catch {
    return { title: 'Design' };
  }
}

/** Starts downloading the main design photo while the page's JavaScript loads. */
export default async function SampleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await loadSample(id);
  const img = s && !s.isTrashed ? s.imageUrl || s.sampleImages?.[0] : undefined;
  return (
    <>
      {/* React moves this into <head> */}
      {img && <link rel="preload" as="image" href={cldThumb(img, 1100, 1375)} fetchPriority="high" />}
      {children}
    </>
  );
}
