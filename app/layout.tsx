import type { Metadata, Viewport } from 'next';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/600-italic.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import '@fontsource/jost/600.css';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'GFive — Glamour Grace Unlimited',
    template: '%s · GFive',
  },
  description: 'GFive Kolkata — designer unstitched suits. Browse samples, pick colours and place your order on WhatsApp.',
  // Staff studio and private customer links (with wholesale rates) should not appear on Google.
  robots: { index: false, follow: false },
  icons: {
    icon: '/brand/icon-192.png',
    apple: '/brand/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#1a3512',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-cream text-ink antialiased">{children}</body>
    </html>
  );
}
