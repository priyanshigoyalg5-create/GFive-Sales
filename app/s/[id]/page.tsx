'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useParams } from 'next/navigation';

export default function CustomerSamplePage() {
  const params = useParams();
  const sampleId = params.id as string;

  const [sample, setSample] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<{ [color: string]: number }>({});

  const [firmName, setFirmName] = useState('');
  const [mobile, setMobile] = useState('');
  const [city, setCity] = useState('');
  const [gstNo, setGstNo] = useState('');
  const [agentName, setAgentName] = useState('');
  const [customerRemarks, setCustomerRemarks] = useState('');

  // Active Main Image Index State for Carousel
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);

  // Zoom Modal Index State
  const [zoomedImageIndex, setZoomedImageIndex] = useState<number | null>(null);

  // Mobile Touch Swipe Coordinates
  const [touchStartX, setTouchStartX] = useState<number>(0);
  const [touchEndX, setTouchEndX] = useState<number>(0);

  const PHONE_NUMBER_1 = '919163932222';

  useEffect(() => {
    async function fetchSample() {
      if (!sampleId) return;
      try {
        const docRef = doc(db, 'samples', sampleId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setSample(data);

          const initialQty: { [col: string]: number } = {};
          if (data.colorDetails && data.colorDetails.length > 0) {
            data.colorDetails.forEach((item: any) => {
              if (item.name) initialQty[item.name] = 0;
            });
          } else if (data.colors) {
            data.colors.forEach((c: string) => (initialQty[c] = 0));
          }
          setQuantities(initialQty);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchSample();
  }, [sampleId]);

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#1e293b', fontWeight: '600' }}>Loading sample details...</div>;
  if (!sample) return <div style={{ padding: 60, textAlign: 'center', color: '#dc2626', fontWeight: '600' }}>Sample not found or removed.</div>;

  // SAFE ARRAY MERGE: Collect all sample photos safely without duplicates
  const rawPhotos: string[] = [];
  if (Array.isArray(sample.sampleImages)) {
    rawPhotos.push(...sample.sampleImages);
  }
  if (sample.imageUrl && !rawPhotos.includes(sample.imageUrl)) {
    rawPhotos.unshift(sample.imageUrl);
  }

  // Also include any color-specific photos safely
  if (sample.colorDetails && Array.isArray(sample.colorDetails)) {
    sample.colorDetails.forEach((item: any) => {
      if (item?.photoUrl && typeof item.photoUrl === 'string' && item.photoUrl.trim() !== '') {
        rawPhotos.push(item.photoUrl);
      }
    });
  }

  const samplePhotosList = Array.from(new Set(rawPhotos)).filter((url) => typeof url === 'string' && url.trim() !== '');

  const totalQuantity = Object.values(quantities).reduce((acc, curr) => acc + Number(curr || 0), 0);
  const totalAmount = totalQuantity * Number(sample.price || 0);

  const handleInputChange = (color: string, val: string) => {
    const num = parseInt(val, 10);
    setQuantities((prev) => ({
      ...prev,
      [color]: isNaN(num) ? 0 : Math.max(0, num),
    }));
  };

  const getColorList = () => {
    if (sample.colorDetails && sample.colorDetails.length > 0) {
      return sample.colorDetails;
    }
    return (sample.colors || []).map((c: string) => ({ name: c, photoUrl: '' }));
  };

  const colorList = getColorList();

  // Carousel Navigation Logic
  const handleNextPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (samplePhotosList.length === 0) return;
    setActivePhotoIndex((prev) => (prev + 1) % samplePhotosList.length);
  };

  const handlePrevPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (samplePhotosList.length === 0) return;
    setActivePhotoIndex((prev) => (prev - 1 + samplePhotosList.length) % samplePhotosList.length);
  };

  // Touch Handlers for Mobile Swipe
  const handleTouchStart = (e: React.TouchEvent) => setTouchStartX(e.targetTouches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => setTouchEndX(e.targetTouches[0].clientX);
  const handleTouchEnd = () => {
    if (!touchStartX || !touchEndX) return;
    const distance = touchStartX - touchEndX;
    if (distance > 40) handleNextPhoto();
    if (distance < -40) handlePrevPhoto();
    setTouchStartX(0);
    setTouchEndX(0);
  };

  const getNextOrderNumber = async () => {
    const counterRef = doc(db, 'counters', 'sales_orders');
    return await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let nextSeq = 0;
      if (counterDoc.exists()) {
        nextSeq = (counterDoc.data().currentSeq || 0) + 1;
      } else {
        nextSeq = 1;
      }
      transaction.set(counterRef, { currentSeq: nextSeq }, { merge: true });
      return `GFive#${nextSeq}`;
    });
  };

  const handlePlaceOrder = async (targetPhone: string) => {
    if (totalQuantity <= 0) {
      alert('Please enter quantity (pcs) for at least one color!');
      return;
    }
    if (!firmName || !mobile || !city) {
      alert('Please fill Firm Name, Mobile Number, and City!');
      return;
    }

    try {
      const customOrderId = await getNextOrderNumber();

      const colorPhotosMap: { [col: string]: string } = {};
      colorList.forEach((item: any) => {
        const cName = typeof item === 'string' ? item : item.name;
        const cUrl = typeof item === 'object' && item.photoUrl && item.photoUrl.trim() !== '' 
          ? item.photoUrl 
          : (sample.imageUrl || '');
        colorPhotosMap[cName] = cUrl;
      });

      await addDoc(collection(db, 'orders'), {
        orderId: customOrderId,
        sampleId,
        designNumber: sample.designNumber,
        price: sample.price,
        firmName,
        mobile,
        city,
        gstNo,
        agentName,
        remarks: customerRemarks,
        items: quantities,
        colorPhotos: colorPhotosMap,
        totalQuantity,
        totalAmount,
        unit: 'pcs',
        createdAt: serverTimestamp(),
      });

      let text = `*-----------GFive KOLKATA-------------*\n`;
      text += `*NEW UNSTITCHED SUIT SAMPLE*\n\n`;
      text += `*Order No:* ${customOrderId}\n`;
      text += `*Design No:* ${sample.designNumber}\n`;
      text += `*Price:* ₹${sample.price}/pc\n\n`;
      text += `*CUSTOMER DETAILS:*\n`;
      text += `• *Firm:* ${firmName}\n`;
      text += `• *Mobile:* ${mobile}\n`;
      text += `• *City:* ${city}\n`;
      if (gstNo) text += `• *GST No:* ${gstNo}\n`;
      if (agentName) text += `• *Agent:* ${agentName}\n`;
      if (customerRemarks) text += `• *Remarks:* ${customerRemarks}\n`;
      
      text += `\n*COLOUR        QUANTITIES:*\n`;
      text += `--------------------------\n`;

      Object.entries(quantities).forEach(([color, qty]: [string, any]) => {
        if (qty > 0) {
          text += `• *${color}* -----------> *${qty} pcs*\n`;
        }
      });

      text += `-------------------------------\n`;
      text += `*TOTAL:* ${totalQuantity} pcs\n`;
      text += `*TOTAL AMOUNT:* ₹${totalAmount}\n`;
      text += `-------------------------------\n`;

      let sharedSuccessfully = false;
      if (navigator.share && sample.imageUrl) {
        try {
          const response = await fetch(sample.imageUrl);
          const blob = await response.blob();
          const imageFile = new File([blob], `Design_${sample.designNumber}.jpg`, { type: blob.type });

          if (navigator.canShare && navigator.canShare({ files: [imageFile] })) {
            await navigator.share({
              text: text,
              files: [imageFile],
            });
            sharedSuccessfully = true;
          }
        } catch (err) {
          console.log('Image share failed, fallback to direct WhatsApp URL', err);
        }
      }

      if (!sharedSuccessfully) {
        const waLink = `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(text)}`;
        window.location.href = waLink;
      }

    } catch (e) {
      console.warn('Error saving order record:', e);
      alert('Order placing failed. Please try again!');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: '#f8fafc',
      padding: '20px 14px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ maxWidth: '440px', width: '100%', color: '#0f172a' }}>
        
        {/* Sample Main Image Card with Carousel */}
        <div style={{
          background: '#ffffff',
          borderRadius: '24px',
          padding: '14px',
          boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.05)',
          border: '1px solid #f1f5f9',
          marginBottom: '18px'
        }}>
          {/* CAROUSEL IMAGE CONTAINER */}
          <div 
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={() => setZoomedImageIndex(activePhotoIndex)}
            style={{ 
              position: 'relative', 
              overflow: 'hidden', 
              borderRadius: '16px', 
              cursor: 'pointer', 
              background: '#f1f5f9',
              userSelect: 'none'
            }}
          >
            <img
              src={samplePhotosList[activePhotoIndex] || sample.imageUrl}
              alt={`Design ${sample.designNumber}`}
              style={{ width: '100%', maxHeight: '380px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
            />

            {/* Photo Counter Badge */}
            {samplePhotosList.length > 1 && (
              <span style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(15, 23, 42, 0.75)',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: '700',
                padding: '4px 10px',
                borderRadius: '20px',
                backdropFilter: 'blur(4px)'
              }}>
                {activePhotoIndex + 1} / {samplePhotosList.length} Photos
              </span>
            )}

            {/* Tap to Zoom Badge */}
            <span style={{
              position: 'absolute',
              bottom: '10px',
              right: '10px',
              background: 'rgba(15, 23, 42, 0.75)',
              color: '#ffffff',
              fontSize: '11px',
              padding: '4px 8px',
              borderRadius: '6px',
              backdropFilter: 'blur(4px)'
            }}>
              🔍 Click to Zoom
            </span>

            {/* Left Carousel Arrow Button */}
            {samplePhotosList.length > 1 && (
              <button
                type="button"
                onClick={handlePrevPhoto}
                style={{
                  position: 'absolute',
                  left: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255, 255, 255, 0.85)',
                  color: '#0f172a',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  zIndex: 10
                }}
              >
                ❮
              </button>
            )}

            {/* Right Carousel Arrow Button */}
            {samplePhotosList.length > 1 && (
              <button
                type="button"
                onClick={handleNextPhoto}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255, 255, 255, 0.85)',
                  color: '#0f172a',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  zIndex: 10
                }}
              >
                ❯
              </button>
            )}
          </div>

          {/* SAMPLE THUMBNAILS STRIP */}
          {samplePhotosList.length > 1 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
              {samplePhotosList.map((imgUrl, idx) => (
                <img
                  key={idx}
                  src={imgUrl}
                  alt={`Sample ${idx + 1}`}
                  onClick={() => setActivePhotoIndex(idx)}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '10px',
                    objectFit: 'cover',
                    cursor: 'pointer',
                    border: activePhotoIndex === idx ? '2.5px solid #2563eb' : '1px solid #cbd5e1',
                    opacity: activePhotoIndex === idx ? 1 : 0.65,
                    flexShrink: 0,
                    transition: 'all 0.2s ease'
                  }}
                />
              ))}
            </div>
          )}

          <div style={{ marginTop: '16px', padding: '0 4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h1 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
                Design #{sample.designNumber}
              </h1>
              <span style={{
                fontSize: '17px',
                color: '#15803d',
                fontWeight: '800',
                background: '#dcfce7',
                padding: '6px 14px',
                borderRadius: '12px',
                border: '1px solid #bbf7d0'
              }}>
                ₹{sample.price} / pc
              </span>
            </div>

            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#334155' }}>
                <strong style={{ color: '#0f172a' }}>Fabric:</strong> {sample.fabric || sample.fabricName || 'N/A'}
              </p>
              {sample.work && (
                <p style={{ margin: 0, fontSize: '14px', color: '#334155' }}>
                  <strong style={{ color: '#0f172a' }}>Work:</strong> {sample.work}
                </p>
              )}
              {sample.remarks && (
                <p style={{ color: '#64748b', fontSize: '13px', marginTop: '6px', fontStyle: 'italic' }}>
                  {sample.remarks}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Select Quantities Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '24px',
          padding: '20px',
          boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.05)',
          border: '1px solid #f1f5f9',
          marginBottom: '18px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <span style={{ fontSize: '18px' }}>🎨</span>
            <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
              Select Quantities (in Pieces)
            </h3>
          </div>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '0 14px',
            marginBottom: '10px',
            fontSize: '12px',
            fontWeight: '700',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            <span>Colour</span>
            <span style={{ width: '100px', textAlign: 'center' }}>QTY</span>
          </div>

          {colorList.map((item: any) => {
            const colorName = typeof item === 'string' ? item : item.name;
            const hasPhoto = typeof item === 'object' && item.photoUrl && item.photoUrl.trim() !== '';
            const photoUrl = hasPhoto ? item.photoUrl : '';

            return (
              <div
                key={colorName}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  padding: '10px 14px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  background: '#f8fafc'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {hasPhoto ? (
                    <div 
                      onClick={() => {
                        const foundIdx = samplePhotosList.indexOf(photoUrl);
                        if (foundIdx !== -1) {
                          setActivePhotoIndex(foundIdx);
                          setZoomedImageIndex(foundIdx);
                        }
                      }}
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '1.5px solid #2563eb',
                        cursor: 'pointer',
                        flexShrink: 0,
                        position: 'relative'
                      }}
                      title="Click to view color photo"
                    >
                      <img 
                        src={photoUrl} 
                        alt={colorName} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    </div>
                  ) : (
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '10px',
                      background: '#e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      flexShrink: 0
                    }}>
                      🎨
                    </div>
                  )}

                  <span style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b' }}>
                    {colorName}
                  </span>
                </div>

                <input
                  type="number"
                  min="0"
                  value={quantities[colorName] === 0 ? '' : quantities[colorName]}
                  placeholder="Enter pcs"
                  onChange={(e) => handleInputChange(colorName, e.target.value)}
                  style={{
                    width: '100px',
                    height: '44px',
                    textAlign: 'center',
                    fontWeight: '800',
                    fontSize: '15px',
                    borderRadius: '10px',
                    border: '2px solid #000000',
                    background: '#ffffff',
                    color: '#0f172a',
                    outline: 'none'
                  }}
                />
              </div>
            );
          })}

          <div style={{
            borderTop: '2px dashed #e2e8f0',
            marginTop: '16px',
            paddingTop: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '15px',
            fontWeight: '800'
          }}>
            <span style={{ color: '#64748b' }}>Total Selected:</span>
            <span style={{ color: '#2563eb', fontSize: '16px' }}>
              {totalQuantity} pcs <span style={{ color: '#0f172a', fontWeight: '700' }}>(₹{totalAmount})</span>
            </span>
          </div>
        </div>

        {/* Firm Details Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '24px',
          padding: '20px',
          boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.05)',
          border: '1px solid #f1f5f9'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '18px' }}>🏢</span>
            <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
              Your Firm Details
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              placeholder="Firm / Company Name *"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              style={{ padding: '14px 16px', borderRadius: '12px', fontSize: '14px', width: '100%', color: '#0f172a', border: '1.5px solid #cbd5e1', background: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <input
                type="tel"
                placeholder="Mobile Number *"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                style={{ padding: '14px 16px', borderRadius: '12px', fontSize: '14px', width: '100%', color: '#0f172a', border: '1.5px solid #cbd5e1', background: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
              />
              <input
                type="text"
                placeholder="City *"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={{ padding: '14px 16px', borderRadius: '12px', fontSize: '14px', width: '100%', color: '#0f172a', border: '1.5px solid #cbd5e1', background: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <input
              type="text"
              placeholder="GST No. (Optional)"
              value={gstNo}
              onChange={(e) => setGstNo(e.target.value)}
              style={{ padding: '14px 16px', borderRadius: '12px', fontSize: '14px', width: '100%', color: '#0f172a', border: '1.5px solid #cbd5e1', background: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
            />

            <input
              type="text"
              placeholder="Agent Name (Optional)"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              style={{ padding: '14px 16px', borderRadius: '12px', fontSize: '14px', width: '100%', color: '#0f172a', border: '1.5px solid #cbd5e1', background: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
            />

            <input
              type="text"
              placeholder="Remarks (Optional)"
              value={customerRemarks}
              onChange={(e) => setCustomerRemarks(e.target.value)}
              style={{ padding: '14px 16px', borderRadius: '12px', fontSize: '14px', width: '100%', color: '#0f172a', border: '1.5px solid #cbd5e1', background: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <button
            onClick={() => handlePlaceOrder(PHONE_NUMBER_1)}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
              color: '#ffffff',
              padding: '18px',
              borderRadius: '14px',
              fontSize: '16px',
              fontWeight: '800',
              border: 'none',
              marginTop: '20px',
              cursor: 'pointer',
              boxShadow: '0 8px 20px -4px rgba(22, 163, 74, 0.4)'
            }}
          >
            💬 Place Order on WhatsApp ({totalQuantity} pcs)
          </button>
        </div>

      </div>

      {/* FULL-SCREEN SWIPEABLE IMAGE ZOOM POPUP MODAL */}
      {zoomedImageIndex !== null && (
        <div 
          onClick={() => setZoomedImageIndex(null)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
            userSelect: 'none'
          }}
        >
          {/* Close Button */}
          <button
            onClick={() => setZoomedImageIndex(null)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: '#ffffff',
              color: '#0f172a',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              fontSize: '20px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              zIndex: 10000
            }}
          >
            ✕
          </button>

          {/* Image Index Counter Badge */}
          {samplePhotosList.length > 1 && (
            <div style={{
              position: 'absolute',
              top: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: '700',
              backdropFilter: 'blur(4px)'
            }}>
              {zoomedImageIndex + 1} / {samplePhotosList.length} (Swipe 👈👉)
            </div>
          )}

          {/* Left Arrow Button */}
          {samplePhotosList.length > 1 && (
            <button
              onClick={handlePrevPhoto}
              style={{
                position: 'absolute',
                left: '12px',
                background: 'rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                fontSize: '22px',
                fontWeight: 'bold',
                cursor: 'pointer',
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ❮
            </button>
          )}

          {/* Zoomed Image Container */}
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90%', maxHeight: '85vh' }}>
            <img
              src={samplePhotosList[zoomedImageIndex]}
              alt={`Zoomed View ${zoomedImageIndex + 1}`}
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                borderRadius: '16px',
                objectFit: 'contain',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
                display: 'block',
                margin: '0 auto'
              }}
            />
          </div>

          {/* Right Arrow Button */}
          {samplePhotosList.length > 1 && (
            <button
              onClick={handleNextPhoto}
              style={{
                position: 'absolute',
                right: '12px',
                background: 'rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                fontSize: '22px',
                fontWeight: 'bold',
                cursor: 'pointer',
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ❯
            </button>
          )}

        </div>
      )}

    </div>
  );
}