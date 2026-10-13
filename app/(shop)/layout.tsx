import { CartProvider } from '@/lib/cart';
import { ShopFooter, ShopHeader } from '@/components/shop/ShopChrome';

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col">
        <ShopHeader />
        <main className="flex-1">{children}</main>
        <ShopFooter />
      </div>
    </CartProvider>
  );
}
