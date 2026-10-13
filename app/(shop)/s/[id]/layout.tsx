import type { Metadata } from 'next';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/** Gives each design link a WhatsApp/Facebook preview with its photo and price. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const snap = await getDoc(doc(db, 'samples', id));
    if (!snap.exists()) return { title: 'Design' };
    const s = snap.data() as { designNumber?: string; price?: number; fabric?: string; work?: string; imageUrl?: string; sampleImages?: string[] };
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

export default function SampleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
