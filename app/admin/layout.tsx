'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 🔄 Updated path from /admin/upload to /admin/add
  const navItems = [
    { name: '📊 Orders Dashboard', path: '/admin/orders' },
    { name: '➕ Add Sample', path: '/admin/add' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* 📱 Mobile Top Header */}
      <div style={{
        display: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '60px',
        background: '#0f172a',
        color: '#ffffff',
        padding: '0 16px',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 1000,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }} className="mobile-header">
        <div style={{ fontSize: '18px', fontWeight: '800' }}>GFive Admin</div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '24px', cursor: 'pointer' }}
        >
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* 🖥️ Left Sidebar Navigation */}
      <aside style={{
        width: '240px',
        background: '#0f172a',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 999,
        transition: 'transform 0.3s ease',
      }} className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        
        {/* Brand Header */}
        <div style={{ paddingBottom: '24px', borderBottom: '1px solid #334155', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#38bdf8' }}>GFive Sales</h2>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>Admin Portal</p>
        </div>

        {/* Sidebar Nav Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '700',
                  color: isActive ? '#ffffff' : '#94a3b8',
                  background: isActive ? '#2563eb' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', paddingTop: '16px', borderTop: '1px solid #334155' }}>
          GFive Studio © 2026
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, marginLeft: '240px', width: 'calc(100% - 240px)', minHeight: '100vh', boxSizing: 'border-box' }} className="main-content">
        {children}
      </main>

      {/* Mobile Responsive Rules */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .mobile-header { display: flex !important; }
          .sidebar {
            transform: translateX(-100%);
            top: 60px !important;
          }
          .sidebar.open {
            transform: translateX(0);
          }
          .main-content {
            margin-left: 0 !important;
            width: 100% !important;
            padding-top: 60px !important;
          }
        }
      `}</style>
    </div>
  );
}