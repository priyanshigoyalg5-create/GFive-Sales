'use client';

import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/lib/auth';
import AdminShell from '@/components/admin/AdminShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return <AuthProvider>{path === '/admin/login' ? children : <AdminShell>{children}</AdminShell>}</AuthProvider>;
}
