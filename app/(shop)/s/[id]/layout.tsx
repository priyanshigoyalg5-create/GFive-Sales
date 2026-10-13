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
        images: img
          ? [{ url: img.replace('/upload/', '/upload/w_800,h_800,c_fill,g_auto,q_80,f_jpg/'), width: 800, height: 800 }]
          : undefined,
      },
    };
  } catch {
    return { title: 'Design' };
  }
}

export default function SampleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
