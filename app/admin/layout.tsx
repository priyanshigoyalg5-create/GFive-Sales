'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#ffffff' }}>
      
      {/* TOP NAVIGATION HEADER BAR */}
      <header style={{
        background: '#0a0f1d',
        borderBottom: '1px solid #1e293b',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '10px'
      }}>
        
        {/* 1. ORDERS DASHBOARD BUTTON */}
        <Link 
          href="/admin/orders" 
          style={{
            background: pathname === '/admin/orders' ? '#2563eb' : 'transparent',
            color: '#ffffff',
            padding: '8px 16px',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '700',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
        >
          📊 Orders Dashboard
        </Link>

        {/* 2. ALL SAMPLES BUTTON (NEWLY ADDED) */}
        <Link 
          href="/admin/samples" 
          style={{
            background: pathname === '/admin/samples' ? '#2563eb' : 'transparent',
            color: '#ffffff',
            padding: '8px 16px',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '700',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
        >
          🛍️ All Samples
        </Link>

        {/* 3. ADD SAMPLE BUTTON */}
        <Link 
          href="/admin/add" 
          style={{
            background: pathname === '/admin/add' ? '#2563eb' : 'transparent',
            color: '#ffffff',
            padding: '8px 16px',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '700',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
        >
          ➕ Add Sample
        </Link>

      </header>

      {/* Main Page Content Container */}
      <main style={{ background: '#f8fafc', minHeight: 'calc(100vh - 60px)' }}>
        {children}
      </main>

    </div>
  );
}