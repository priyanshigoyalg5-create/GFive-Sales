import { ShopFooter, ShopHeader } from '@/components/shop/ShopChrome';

/** Layout for the customer order link that staff share on WhatsApp. */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ShopHeader />
      <main className="flex-1">{children}</main>
      <ShopFooter />
    </div>
  );
}
