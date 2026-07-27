import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GFive Sales Studio',
  description: 'Unstitched Suit Ordering App',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, boxSizing: 'border-box' }}>
        {children}
      </body>
    </html>
  );
}