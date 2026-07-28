'use client';

import React, { useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, getDoc, where, getDocs } from 'firebase/firestore';

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

  // Gallery Modal State
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [currentGalleryImages, setCurrentGalleryImages] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [galleryDesignNo, setGalleryDesignNo] = useState('');

  const invoiceRef = useRef<HTMLDivElement>(null);

  // High-Res Logo URL
  const GFIVE_LOGO_URL = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR-9AdJ4aF84PW7lWlDW1mJweHreNhFnUsvDMKlRhnT&s';

  const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
    if (!imageUrl) return '';
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(imageUrl);
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn('Base64 Conversion failed:', err);
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

  const handleOpenGalleryModal = async (order: any) => {
    setGalleryDesignNo(order.designNumber || '');
    let mainSamples: string[] = [];
    let customColorPhotos: string[] = [];
    let sampleData: any = null;

    try {
      if (order.sampleId) {
        const sSnap = await getDoc(doc(db, 'samples', order.sampleId));
        if (sSnap.exists()) {
          sampleData = sSnap.data();
        }
      }

      if (!sampleData && order.designNumber) {
        const q = query(collection(db, 'samples'), where('designNumber', '==', String(order.designNumber)));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          sampleData = qSnap.docs[0].data();
        }
      }

      if (sampleData) {
        if (sampleData.sampleImages && Array.isArray(sampleData.sampleImages) && sampleData.sampleImages.length > 0) {
          mainSamples = sampleData.sampleImages.filter((u: string) => typeof u === 'string' && u.trim() !== '');
        } else if (sampleData.imageUrl) {
          mainSamples = [sampleData.imageUrl];
        }

        if (sampleData.colorDetails && Array.isArray(sampleData.colorDetails)) {
          sampleData.colorDetails.forEach((cd: any) => {
            if (cd.photoUrl && cd.photoUrl.trim() !== '' && !mainSamples.includes(cd.photoUrl)) {
              customColorPhotos.push(cd.photoUrl);
            }
          });
        }
      }
    } catch (err) {
      console.warn('Error fetching sample images:', err);
    }

    if (mainSamples.length === 0) {
      if (order.colorPhotos) {
        Object.values(order.colorPhotos).forEach((u: any) => {
          if (typeof u === 'string' && u.trim() !== '') {
            customColorPhotos.push(u);
          }
        });
      }
    }

    const finalSequence = Array.from(new Set([...mainSamples, ...customColorPhotos]));

    if (finalSequence.length === 0) {
      alert('No preview photos found for this design.');
      return;
    }

    setCurrentGalleryImages(finalSequence);
    setActiveImageIndex(0);
    setGalleryModalOpen(true);
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (filteredIds: string[]) => {
    const allSelected = filteredIds.every((id) => selectedOrderIds.includes(id));
    if (allSelected) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredIds);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const docRef = doc(db, 'orders', orderId);
      await updateDoc(docRef, { status: newStatus });
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleMoveToTrash = async (orderId: string) => {
    try {
      const docRef = doc(db, 'orders', orderId);
      await updateDoc(docRef, { isTrashed: true });
    } catch (err) {
      console.error('Failed to move to trash:', err);
    }
  };

  const handleRestoreFromTrash = async (orderId: string) => {
    try {
      const docRef = doc(db, 'orders', orderId);
      await updateDoc(docRef, { isTrashed: false });
    } catch (err) {
      console.error('Failed to restore order:', err);
    }
  };

  const handlePermanentDelete = async (orderId: string, displayOrderId: string) => {
    if (confirm(`⚠️ Permanently delete order ${displayOrderId}?`)) {
      try {
        await deleteDoc(doc(db, 'orders', orderId));
      } catch (err) {
        console.error('Failed to permanently delete order:', err);
      }
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
    }
  };

  const handleBulkPermanentDelete = async () => {
    if (selectedOrderIds.length === 0) return;
    if (confirm(`⚠️ Permanently delete ${selectedOrderIds.length} selected order(s)?`)) {
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
            margin: [0.2, 0.2, 0.2, 0.2],
            filename: fileName,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, allowTaint: true, logging: false },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
          };

          await html2pdf().from(element).set(opt).save();
        }
      } catch (err) {
        console.error('Invoice PDF Download Failed:', err);
      } finally {
        setIsGeneratingPdf(false);
      }
    }, 600);
  };

  const handlePrintInvoice = async (order: any) => {
    setSelectedOrder(order);
    setTimeout(() => {
      if (invoiceRef.current) {
        const printHtml = invoiceRef.current.innerHTML;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Invoice_${order.orderId || order.id}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  * { box-sizing: border-box; }
                  body { margin: 0; padding: 15px; font-family: Arial, sans-serif; background: #ffffff; color: #000000; }
                  img { max-width: 100% !important; height: auto !important; display: inline-block; }
                  table { width: 100%; border-collapse: collapse; }
                  th, td { border-bottom: 1px solid #ddd; padding: 8px; }
                  @media print {
                    @page { margin: 0.3in; size: auto; }
                    body { padding: 0; }
                  }
                </style>
              </head>
              <body>
                ${printHtml}
                <script>
                  window.onload = function() {
                    setTimeout(function() {
                      window.print();
                      window.close();
                    }, 500);
                  };
                </script>
              </body>
            </html>
          `);
          printWindow.document.close();
        } else {
          // Mobile Fallback agar popup blocked ho
          window.print();
        }
      }
    }, 400);
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
        const cleanQuery = rawSearch.replace(/\D/g, '');

        if (cleanQuery === '') return false;
        return orderDigitsOnly.includes(cleanQuery);
      } else if (searchMode === 'firmName') {
        return (order.firmName || '').toLowerCase().includes(rawSearch);
      } else if (searchMode === 'designNumber') {
        return String(order.designNumber || '').toLowerCase().includes(rawSearch);
      } else if (searchMode === 'city') {
        return (order.city || '').toLowerCase().includes(rawSearch);
      } else if (searchMode === 'mobile') {
        return (order.mobile || '').toLowerCase().includes(rawSearch);
      }
    }

    return true;
  });

  const filteredOrderIds = filteredOrders.map((o) => o.id);
  const isAllFilteredSelected = filteredOrderIds.length > 0 && filteredOrderIds.every((id) => selectedOrderIds.includes(id));

  const todayDateStr = new Date().toDateString();
  const activeValidOrders = orders.filter((o) => !o.isTrashed && o.status !== 'Cancelled');
  const todayOrders = activeValidOrders.filter((o) => o.createdAt?.toDate && o.createdAt.toDate().toDateString() === todayDateStr);
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
      padding: '24px 14px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              📊 Orders Dashboard
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
              Realtime customer orders & PDF invoice manager
            </p>
          </div>
        </div>

        {/* Sales Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px 18px' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Active Orders</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>{activeValidOrders.length}</div>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px 18px' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Today's Orders</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#2563eb', marginTop: '4px' }}>{todayOrders.length}</div>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px 18px' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Total Quantity Sold</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#0891b2', marginTop: '4px' }}>{totalPieces} pcs</div>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px 18px' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Total Sales Amount</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#16a34a', marginTop: '4px' }}>₹{totalRevenue.toLocaleString()}</div>
          </div>
        </div>

        {/* Search & Filters */}
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
                outline: 'none'
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
                searchMode === 'orderId' ? "Enter Order ID (e.g. 16)" :
                searchMode === 'firmName' ? "Enter Firm Name..." :
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
                  color: statusFilter === status ? '#ffffff' : status === 'Trash' ? '#dc2626' : '#475569'
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

        {/* Bulk Selection Bar */}
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
                    <button onClick={handleBulkRestore} style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                      🔄 Restore Selected
                    </button>
                    <button onClick={handleBulkPermanentDelete} style={{ background: '#dc2626', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                      💥 Delete Permanently
                    </button>
                  </>
                ) : (
                  <button onClick={handleBulkMoveToTrash} style={{ background: '#dc2626', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                    🗑️ Move Selected to Trash
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '40px', textAlign: 'center', color: '#ef4444', fontWeight: '700' }}>
            No matching orders found.
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
                    border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
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
                      <span style={{ fontSize: '16px', fontWeight: '800', color: '#2563eb' }}>
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
                      {order.gstNo && <div style={{ color: '#64748b', fontSize: '12px' }}>GST: {order.gstNo}</div>}
                      {order.agentName && <div style={{ color: '#64748b', fontSize: '12px' }}>Agent: {order.agentName}</div>}
                    </div>

                    <div>
                      <div style={{ color: '#0f172a', fontWeight: '700' }}>Design #{order.designNumber}</div>
                      <div style={{ color: '#16a34a', fontWeight: '800', fontSize: '15px', marginTop: '2px' }}>
                        {order.totalQuantity} pcs • ₹{order.totalAmount?.toLocaleString()}
                      </div>
                      {order.remarks && <div style={{ color: '#ef4444', fontSize: '12px', fontStyle: 'italic', marginTop: '2px' }}>Note: {order.remarks}</div>}
                    </div>
                  </div>

                  {/* Quantities Badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', background: '#f8fafc', padding: '10px', borderRadius: '10px' }}>
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

                  {/* BOTTOM ACTION BUTTONS */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap', gap: '8px' }}>
                    {isTrashed ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleRestoreFromTrash(order.id)} style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                          🔄 Restore
                        </button>
                        <button onClick={() => handlePermanentDelete(order.id, displayOrderId)} style={{ background: '#dc2626', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                          💥 Permanent Delete
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => handleMoveToTrash(order.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: 0 }}>
                        🗑️ Move to Trash
                      </button>
                    )}

                    {!isTrashed && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenGalleryModal(order)}
                          style={{
                            background: '#2563eb',
                            color: '#ffffff',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
                          }}
                        >
                          📷 View Samples
                        </button>

                        <button
                          type="button"
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
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          🖨️ Print
                        </button>

                        <button
                          type="button"
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
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {isGeneratingPdf && selectedOrder?.id === order.id ? '📄 Generating...' : `📄 Invoice (${displayOrderId})`}
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

      {/* SAMPLE PREVIEW SWIPE GALLERY MODAL */}
      {galleryModalOpen && currentGalleryImages.length > 0 && (
        <div 
          onClick={() => setGalleryModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '520px',
              width: '100%',
              background: '#0f172a',
              borderRadius: '24px',
              padding: '20px',
              color: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>
                  Design #{galleryDesignNo} Samples
                </h3>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Image {activeImageIndex + 1} of {currentGalleryImages.length}
                </span>
              </div>
              <button
                onClick={() => setGalleryModalOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ position: 'relative', width: '100%', height: '360px', background: '#000000', borderRadius: '16px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={currentGalleryImages[activeImageIndex]}
                alt={`Sample ${activeImageIndex + 1}`}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />

              {currentGalleryImages.length > 1 && (
                <button
                  onClick={() => setActiveImageIndex((prev) => (prev === 0 ? currentGalleryImages.length - 1 : prev - 1))}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    background: 'rgba(15, 23, 42, 0.75)',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    fontSize: '20px',
                    cursor: 'pointer'
                  }}
                >
                  ❮
                </button>
              )}

              {currentGalleryImages.length > 1 && (
                <button
                  onClick={() => setActiveImageIndex((prev) => (prev === currentGalleryImages.length - 1 ? 0 : prev + 1))}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'rgba(15, 23, 42, 0.75)',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    fontSize: '20px',
                    cursor: 'pointer'
                  }}
                >
                  ❯
                </button>
              )}
            </div>

            {currentGalleryImages.length > 1 && (
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginTop: '14px', paddingBottom: '6px' }}>
                {currentGalleryImages.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      border: activeImageIndex === idx ? '2.5px solid #3b82f6' : '1px solid #334155',
                      opacity: activeImageIndex === idx ? 1 : 0.6,
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    <img src={imgUrl} alt="thumb" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      )}

      {/* PRINTABLE INVOICE TEMPLATE */}
      {/* PRINTABLE INVOICE TEMPLATE */}
      {selectedOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, opacity: 0, pointerEvents: 'none', zIndex: -1000, overflow: 'hidden' }}>
          <div ref={invoiceRef} style={{ width: '680px', padding: '24px', background: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#1e293b', boxSizing: 'border-box' }}>
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
                    style={{ width: '100%', height: '100px', objectFit: 'contain' }} 
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
                      {index === 0 ? (
                        <td style={{ padding: '12px 10px', fontWeight: 'bold', verticalAlign: 'middle' }} rowSpan={Object.keys(selectedOrder.items).filter(k => selectedOrder.items[k] > 0).length}>
                          <div>#{selectedOrder.designNumber}</div>
                          {photoUrl && (
                            <div style={{ marginTop: '6px' }}>
                              <img 
                                src={photoUrl} 
                                alt={selectedOrder.designNumber} 
                                style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #cbd5e1' }} 
                              />
                            </div>
                          )}
                        </td>
                      ) : null}

                      <td style={{ padding: '12px 10px', fontWeight: '700', color: '#1e293b', verticalAlign: 'middle' }}>
                        {col}
                      </td>

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

                      <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'middle' }}>
                        {qty} pcs
                      </td>

                      <td style={{ padding: '12px 10px', textAlign: 'right', verticalAlign: 'middle' }}>
                        ₹{selectedOrder.price}.00/pc
                      </td>

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