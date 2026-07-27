'use client';

import React, { useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string>('');

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMode, setSearchMode] = useState<'orderId' | 'firmName' | 'designNumber' | 'city' | 'mobile'>('orderId');
  const [statusFilter, setStatusFilter] = useState('All');

  // Multi-Selection State
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const invoiceRef = useRef<HTMLDivElement>(null);

  // High-Res Logo URL
  const GFIVE_LOGO_URL = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR-9AdJ4aF84PW7lWlDW1mJweHreNhFnUsvDMKlRhnT&s';

  // Base64 Converter for html2canvas
  const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn('Base64 Conversion failed via fetch:', err);
      return imageUrl;
    }
  };

  useEffect(() => {
    getBase64ImageFromUrl(GFIVE_LOGO_URL).then((b64) => setLogoBase64(b64));

    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orderData = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      orderData.sort((a: any, b: any) => {
        const statusA = a.status || 'Pending';
        const statusB = b.status || 'Pending';

        const isInactiveA = statusA === 'Completed' || statusA === 'Cancelled';
        const isInactiveB = statusB === 'Completed' || statusB === 'Cancelled';

        if (isInactiveA && !isInactiveB) return 1;
        if (!isInactiveA && isInactiveB) return -1;
        return 0;
      });

      setOrders(orderData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orders: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleStatusChange = async (orderDocId: string, newStatus: string) => {
    try {
      const orderRef = doc(db, 'orders', orderDocId);
      await updateDoc(orderRef, { status: newStatus });
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status. Please try again.');
    }
  };

  const handleMoveToTrash = async (orderDocId: string) => {
    try {
      const orderRef = doc(db, 'orders', orderDocId);
      await updateDoc(orderRef, { isTrashed: true });
    } catch (err) {
      console.error('Failed to move to trash:', err);
    }
  };

  const handleRestoreFromTrash = async (orderDocId: string) => {
    try {
      const orderRef = doc(db, 'orders', orderDocId);
      await updateDoc(orderRef, { isTrashed: false });
    } catch (err) {
      console.error('Failed to restore order:', err);
    }
  };

  const handlePermanentDelete = async (orderDocId: string, orderIdStr: string) => {
    if (confirm(`Are you sure you want to PERMANENTLY delete order ${orderIdStr}? This action cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, 'orders', orderDocId));
        setSelectedOrderIds((prev) => prev.filter((id) => id !== orderDocId));
      } catch (err) {
        console.error('Failed to delete order:', err);
        alert('Failed to delete order.');
      }
    }
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (filteredIds: string[]) => {
    const allSelectedInFiltered = filteredIds.every((id) => selectedOrderIds.includes(id));
    if (allSelectedInFiltered) {
      setSelectedOrderIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      const newSelections = new Set([...selectedOrderIds, ...filteredIds]);
      setSelectedOrderIds(Array.from(newSelections));
    }
  };

  const handleBulkMoveToTrash = async () => {
    if (selectedOrderIds.length === 0) return;
    if (confirm(`Move ${selectedOrderIds.length} selected order(s) to Trash?`)) {
      try {
        const batch = writeBatch(db);
        selectedOrderIds.forEach((id) => {
          const docRef = doc(db, 'orders', id);
          batch.update(docRef, { isTrashed: true });
        });
        await batch.commit();
        setSelectedOrderIds([]);
      } catch (err) {
        console.error('Bulk trash failed:', err);
        alert('Failed to move items to trash.');
      }
    }
  };

  const handleBulkRestore = async () => {
    if (selectedOrderIds.length === 0) return;
    try {
      const batch = writeBatch(db);
      selectedOrderIds.forEach((id) => {
        const docRef = doc(db, 'orders', id);
        batch.update(docRef, { isTrashed: false });
      });
      await batch.commit();
      setSelectedOrderIds([]);
    } catch (err) {
      console.error('Bulk restore failed:', err);
      alert('Failed to restore items.');
    }
  };

  const handleBulkPermanentDelete = async () => {
    if (selectedOrderIds.length === 0) return;
    if (confirm(`⚠️ WARNING: Permanently delete ${selectedOrderIds.length} selected order(s)? This CANNOT be undone!`)) {
      try {
        const batch = writeBatch(db);
        selectedOrderIds.forEach((id) => {
          const docRef = doc(db, 'orders', id);
          batch.delete(docRef);
        });
        await batch.commit();
        setSelectedOrderIds([]);
      } catch (err) {
        console.error('Bulk delete failed:', err);
        alert('Failed to permanently delete items.');
      }
    }
  };

  const loadHtml2Pdf = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).html2pdf) {
        resolve((window as any).html2pdf);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => resolve((window as any).html2pdf);
      script.onerror = () => reject('Failed to load html2pdf script');
      document.body.appendChild(script);
    });
  };

  const handleDownloadInvoice = async (order: any) => {
    setSelectedOrder(order);
    setIsGeneratingPdf(true);

    setTimeout(async () => {
      try {
        const html2pdf = await loadHtml2Pdf();
        const element = invoiceRef.current;

        if (element) {
          const displayOrderId = order.orderId || `GFive#${order.id.substring(0, 5)}`;
          const fileName = `${displayOrderId.replace('#', '_')}.pdf`;

          const opt = {
            margin: 0.3,
            filename: fileName,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, allowTaint: true },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
          };

          await html2pdf().set(opt).from(element).save();
        }
      } catch (err) {
        console.error('Invoice PDF Download Failed:', err);
        alert('Failed to generate PDF invoice. Please try again.');
      } finally {
        setIsGeneratingPdf(false);
      }
    }, 500);
  };

  const handlePrintInvoice = (order: any) => {
    setSelectedOrder(order);
    setTimeout(() => {
      if (invoiceRef.current) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <title>Invoice_${order.orderId || order.id}</title>
                <style>
                  body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
                  @media print {
                    @page { margin: 0.3in; }
                  }
                </style>
              </head>
              <body>
                ${invoiceRef.current.innerHTML}
              </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
          }, 300);
        }
      }
    }, 300);
  };

  const filteredOrders = orders.filter((order) => {
    const isTrashed = !!order.isTrashed;

    if (statusFilter === 'Trash') {
      if (!isTrashed) return false;
    } else {
      if (isTrashed) return false;
      const currentStatus = order.status || 'Pending';
      if (statusFilter !== 'All' && currentStatus !== statusFilter) {
        return false;
      }
    }

    const rawSearch = searchTerm.trim().toLowerCase();
    if (rawSearch !== '') {
      if (searchMode === 'orderId') {
        const fullOrderIdStr = order.orderId || `GFive#${order.id.substring(0, 5)}`;
        const orderDigitsOnly = fullOrderIdStr.replace(/\D/g, '');
        const hasText = /[a-zA-Z]/.test(rawSearch);
        const cleanQuery = rawSearch.replace(/\D/g, '');

        if (hasText || cleanQuery === '') {
          return false;
        }
        return orderDigitsOnly.includes(cleanQuery);
      } else if (searchMode === 'firmName') {
        const firm = (order.firmName || '').toLowerCase();
        return firm.includes(rawSearch);
      } else if (searchMode === 'designNumber') {
        const design = String(order.designNumber || '').toLowerCase();
        return design.includes(rawSearch);
      } else if (searchMode === 'city') {
        const city = (order.city || '').toLowerCase();
        return city.includes(rawSearch);
      } else if (searchMode === 'mobile') {
        const mobile = (order.mobile || '').toLowerCase();
        return mobile.includes(rawSearch);
      }
    }

    return true;
  });

  const filteredOrderIds = filteredOrders.map((o) => o.id);
  const isAllFilteredSelected = filteredOrderIds.length > 0 && filteredOrderIds.every((id) => selectedOrderIds.includes(id));

  const todayDateStr = new Date().toDateString();
  const activeValidOrders = orders.filter((o) => !o.isTrashed && o.status !== 'Cancelled');
  
  const todayOrders = activeValidOrders.filter(
    (o) => o.createdAt?.toDate && o.createdAt.toDate().toDateString() === todayDateStr
  );

  const totalRevenue = activeValidOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const totalPieces = activeValidOrders.reduce((sum, o) => sum + Number(o.totalQuantity || 0), 0);
  const trashCount = orders.filter((o) => !!o.isTrashed).length;

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: '#0f172a', fontWeight: 'bold' }}>Loading Live Orders...</div>;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '24px 16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              📊 Orders Dashboard
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Realtime customer orders & PDF invoice manager
            </p>
          </div>
        </div>

        {/* Sales Summary Cards Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Active Orders</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>{activeValidOrders.length}</div>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Today's Orders</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#2563eb', marginTop: '4px' }}>{todayOrders.length}</div>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Total Quantity Sold</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#0891b2', marginTop: '4px' }}>{totalPieces} pcs</div>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Total Sales Amount</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#16a34a', marginTop: '4px' }}>₹{totalRevenue.toLocaleString()}</div>
          </div>
        </div>

        {/* Dynamic Search Bar */}
        <div style={{ background: '#ffffff', padding: '14px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          
          <div style={{ flex: '1 1 320px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={searchMode}
              onChange={(e: any) => {
                setSearchMode(e.target.value);
                setSearchTerm('');
              }}
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                border: '2px solid #cbd5e1',
                fontSize: '13px',
                fontWeight: '800',
                background: '#f8fafc',
                color: '#0f172a',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="orderId">🔢 Order ID</option>
              <option value="firmName">🏢 Company / Firm Name</option>
              <option value="designNumber">👗 Design No.</option>
              <option value="city">🏙️ City</option>
              <option value="mobile">📞 Mobile No.</option>
            </select>

            <input
              type="text"
              placeholder={
                searchMode === 'orderId' ? "Enter Order ID digits (e.g. 2778)" :
                searchMode === 'firmName' ? "Enter Firm / Company Name..." :
                searchMode === 'designNumber' ? "Enter Design Number..." :
                searchMode === 'city' ? "Enter City Name..." : "Enter Mobile Number..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '2px solid #cbd5e1',
                fontSize: '14px',
                fontWeight: '700',
                color: '#000000',
                background: '#ffffff',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {['All', 'Pending', 'Dispatched', 'Completed', 'Cancelled', 'Trash'].map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  setSelectedOrderIds([]);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '700',
                  border: 'none',
                  cursor: 'pointer',
                  background: statusFilter === status ? (status === 'Trash' ? '#dc2626' : '#0f172a') : '#f1f5f9',
                  color: statusFilter === status ? '#ffffff' : status === 'Trash' ? '#dc2626' : '#475569',
                  transition: 'all 0.2s'
                }}
              >
                {status === 'All' ? 'All' :
                 status === 'Pending' ? '⏳ Pending' :
                 status === 'Dispatched' ? '🚚 Dispatched' :
                 status === 'Completed' ? '✅ Completed' :
                 status === 'Cancelled' ? '❌ Cancelled' :
                 `🗑️ Trash (${trashCount})`}
              </button>
            ))}
          </div>

        </div>

        {/* BULK SELECTION CONTROL BAR */}
        {filteredOrders.length > 0 && (
          <div style={{ background: '#ffffff', padding: '12px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
              <input
                type="checkbox"
                checked={isAllFilteredSelected}
                onChange={() => handleSelectAll(filteredOrderIds)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563eb' }}
              />
              Select All Shown ({filteredOrders.length})
            </label>

            {selectedOrderIds.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#2563eb', background: '#dbeafe', padding: '4px 10px', borderRadius: '6px' }}>
                  {selectedOrderIds.length} Selected
                </span>

                {statusFilter === 'Trash' ? (
                  <>
                    <button
                      onClick={handleBulkRestore}
                      style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      🔄 Restore Selected
                    </button>
                    <button
                      onClick={handleBulkPermanentDelete}
                      style={{ background: '#dc2626', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      💥 Delete Permanently
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleBulkMoveToTrash}
                    style={{ background: '#dc2626', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    🗑️ Move Selected to Trash
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '40px', textAlign: 'center', color: statusFilter === 'Trash' ? '#64748b' : '#ef4444', border: '1px solid #fee2e2', fontWeight: '700' }}>
            {statusFilter === 'Trash' ? '🗑️ Trash is currently empty.' : '❌ No matching orders found for selected criteria.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filteredOrders.map((order) => {
              const currentStatus = order.status || 'Pending';
              const isCompleted = currentStatus === 'Completed';
              const isCancelled = currentStatus === 'Cancelled';
              const isTrashed = !!order.isTrashed;
              const isSelected = selectedOrderIds.includes(order.id);
              const displayOrderId = order.orderId || `GFive#${order.id.substring(0, 5)}`;

              const formattedDate = order.createdAt?.toDate 
                ? order.createdAt.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'Just now';

              return (
                <div 
                  key={order.id} 
                  style={{
                    background: isSelected ? '#eff6ff' : isTrashed ? '#fff1f2' : isCancelled ? '#fef2f2' : isCompleted ? '#f1f5f9' : '#ffffff',
                    opacity: isTrashed ? 0.75 : isCancelled ? 0.65 : isCompleted ? 0.85 : 1,
                    borderRadius: '16px',
                    padding: '18px',
                    border: isSelected ? '2px solid #2563eb' : isTrashed ? '1px dashed #f43f5e' : isCancelled ? '1px dashed #fca5a5' : isCompleted ? '1px dashed #cbd5e1' : '1px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOrder(order.id)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563eb' }}
                      />

                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Order ID:</span>
                      <span style={{ fontSize: '16px', fontWeight: '800', color: isTrashed || isCancelled ? '#ef4444' : '#2563eb', textDecoration: isTrashed || isCancelled ? 'line-through' : 'none' }}>
                        {displayOrderId}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>{formattedDate}</span>

                      {!isTrashed && (
                        <select
                          value={currentStatus}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '800',
                            border: 'none',
                            cursor: 'pointer',
                            outline: 'none',
                            background: currentStatus === 'Pending' ? '#fef3c7' : currentStatus === 'Dispatched' ? '#dbeafe' : currentStatus === 'Completed' ? '#dcfce7' : '#fee2e2',
                            color: currentStatus === 'Pending' ? '#92400e' : currentStatus === 'Dispatched' ? '#1e40af' : currentStatus === 'Completed' ? '#15803d' : '#b91c1c'
                          }}
                        >
                          <option value="Pending">⏳ Pending</option>
                          <option value="Dispatched">🚚 Dispatched</option>
                          <option value="Completed">✅ Completed</option>
                          <option value="Cancelled">❌ Cancelled</option>
                        </select>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '14px' }}>
                    <div>
                      <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '16px' }}>{order.firmName}</div>
                      <div style={{ color: '#475569', marginTop: '2px' }}>📞 {order.mobile} | 🏙️ {order.city}</div>
                      {order.gstNo && <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>GST: {order.gstNo}</div>}
                      {order.agentName && <div style={{ color: '#64748b', fontSize: '12px' }}>Agent: {order.agentName}</div>}
                    </div>

                    <div>
                      <div style={{ color: '#0f172a', fontWeight: '700' }}>Design #{order.designNumber}</div>
                      <div style={{ color: isTrashed || isCancelled ? '#ef4444' : '#16a34a', fontWeight: '800', fontSize: '15px', marginTop: '2px' }}>
                        {order.totalQuantity} pcs • ₹{order.totalAmount?.toLocaleString()}
                      </div>
                      {order.remarks && <div style={{ color: '#ef4444', fontSize: '12px', fontStyle: 'italic', marginTop: '2px' }}>Note: {order.remarks}</div>}
                    </div>
                  </div>

                  {/* Quantities Badges in Dashboard */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', background: isTrashed ? '#ffe4e6' : isCancelled ? '#fecaca' : isCompleted ? '#e2e8f0' : '#f8fafc', padding: '10px', borderRadius: '10px' }}>
                    {order.items && Object.entries(order.items).map(([color, qty]: [string, any]) => {
                      if (qty <= 0) return null;
                      const colorPhoto = order.colorPhotos?.[color] || '';

                      return (
                        <span key={color} style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {colorPhoto && <img src={colorPhoto} alt={color} style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'cover' }} />}
                          {color}: {qty} pcs
                        </span>
                      );
                    })}
                  </div>

                  {/* Bottom Action Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap', gap: '8px' }}>
                    {isTrashed ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleRestoreFromTrash(order.id)}
                          style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          🔄 Restore
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(order.id, displayOrderId)}
                          style={{ background: '#dc2626', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          💥 Permanent Delete
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleMoveToTrash(order.id)}
                        style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: 0 }}
                      >
                        🗑️ Move to Trash
                      </button>
                    )}

                    {!isTrashed && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handlePrintInvoice(order)}
                          style={{
                            background: '#e2e8f0',
                            color: '#0f172a',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          🖨️ Print
                        </button>

                        <button
                          onClick={() => handleDownloadInvoice(order)}
                          disabled={isGeneratingPdf && selectedOrder?.id === order.id}
                          style={{
                            background: '#0f172a',
                            color: '#ffffff',
                            padding: '10px 18px',
                            borderRadius: '10px',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {isGeneratingPdf && selectedOrder?.id === order.id ? '📄 Generating PDF...' : `📄 Download Invoice (${displayOrderId})`}
                        </button>
                      </div>
                    )}

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* 📄 PRINTABLE INVOICE TEMPLATE WITH SEPARATE COLOR PHOTO COLUMN */}
      {selectedOrder && (
        <div style={{ position: 'fixed', left: '-9999px', top: '0', width: '750px', zIndex: -100 }}>
          <div ref={invoiceRef} style={{ width: '750px', padding: '40px', background: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#1e293b' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '20px', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', letterSpacing: '1px', color: '#1e293b' }}>Sales order</div>
                <div style={{ fontSize: '13px', color: '#475569', marginTop: '8px', fontWeight: 'bold' }}>Gfive Designer Studio Pvt Ltd </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>info@gfive.co.in | www.gfive.co.in</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>GST no -19AJCG3693D1ZD</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>113, Park Street, Kol-16 </div>
              </div>

              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ width: '300px', height: '120px', marginBottom: '2px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <img 
                    src={logoBase64 || GFIVE_LOGO_URL} 
                    alt="GFive Logo" 
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                  />
                </div>
                <div style={{ fontSize: '13px', marginTop: '2px' }}>
                  <strong>S.A. No:</strong> {selectedOrder.orderId || `GFive#${selectedOrder.id.substring(0, 5)}`}
                </div>
                <div style={{ fontSize: '13px' }}>
                  <strong>S.A. date:</strong> {selectedOrder.createdAt?.toDate ? selectedOrder.createdAt.toDate().toLocaleDateString('en-GB') : 'Today'}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '24px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Billing Address</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>{selectedOrder.firmName}</div>
              <div style={{ fontSize: '13px', color: '#334155' }}>Phone: {selectedOrder.mobile} | City: {selectedOrder.city}</div>
              {selectedOrder.gstNo && <div style={{ fontSize: '13px', color: '#334155' }}>GST: {selectedOrder.gstNo}</div>}
              {selectedOrder.agentName && <div style={{ fontSize: '13px', color: '#334155' }}>Agent: {selectedOrder.agentName}</div>}
            </div>

            {/* Table with Dedicated Color Photo Column */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>Item / Design</th>
                  <th style={{ padding: '10px' }}>Color Name</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Color Preview</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Qty</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Rate</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrder.items && Object.entries(selectedOrder.items).map(([col, qty]: [string, any], index: number) => {
                  if (qty <= 0) return null;
                  const photoUrl = selectedOrder.colorPhotos?.[col] || '';

                  return (
                    <tr key={col} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      {/* Show Design number only on first row */}
                      {index === 0 ? (
                        <td style={{ padding: '12px 10px', fontWeight: 'bold', verticalAlign: 'middle' }} rowSpan={Object.keys(selectedOrder.items).filter(k => selectedOrder.items[k] > 0).length}>
                          #{selectedOrder.designNumber}
                        </td>
                      ) : null}

                      {/* Color Name */}
                      <td style={{ padding: '12px 10px', fontWeight: '700', color: '#1e293b', verticalAlign: 'middle' }}>
                        {col}
                      </td>

                      {/* Color Image Column */}
                      <td style={{ padding: '8px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                        {photoUrl ? (
                          <img 
                            src={photoUrl} 
                            alt={col} 
                            style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #cbd5e1', display: 'inline-block' }} 
                          />
                        ) : (
                          <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: '14px' }}>
                            🎨
                          </div>
                        )}
                      </td>

                      {/* Quantity */}
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'middle' }}>
                        {qty} pcs
                      </td>

                      {/* Rate */}
                      <td style={{ padding: '12px 10px', textAlign: 'right', verticalAlign: 'middle' }}>
                        ₹{selectedOrder.price}.00/pc
                      </td>

                      {/* Amount */}
                      <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'middle' }}>
                        ₹{(qty * Number(selectedOrder.price || 0)).toLocaleString()}.00
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {selectedOrder.remarks && (
              <div style={{ marginBottom: '24px', fontSize: '13px' }}>
                <strong>Order Changes / Remarks:</strong>
                <div style={{ background: '#fef2f2', padding: '10px', borderRadius: '6px', marginTop: '4px', border: '1px solid #fecaca' }}>{selectedOrder.remarks}</div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #000', paddingTop: '16px', marginBottom: '40px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#15803d' }}>Thanks for your Business!</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a' }}>Total: ₹{selectedOrder.totalAmount?.toLocaleString()}.00</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '50px', fontSize: '12px', textAlign: 'center' }}>
              <div style={{ width: '200px', borderTop: '1px solid #000', paddingTop: '8px' }}>
                <div>{selectedOrder.firmName}</div>
                <div style={{ fontWeight: 'bold' }}>Signature customer</div>
              </div>
              <div style={{ width: '200px', borderTop: '1px solid #000', paddingTop: '8px' }}>
                <div>GFive Sales</div>
                <div style={{ fontWeight: 'bold' }}>Signature sales manager</div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}