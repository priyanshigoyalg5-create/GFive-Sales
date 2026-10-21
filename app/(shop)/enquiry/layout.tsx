import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New designs & enquiry',
  description: 'GFive Kolkata — designer unstitched suits (wholesale). See the newest designs and ask for rates.',
  openGraph: { title: 'GFive Kolkata — New designs', description: 'Designer unstitched suits (wholesale). Tap to see designs and enquire.', images: ['/brand/logo-round.png'] },
};

export default function EnquiryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
