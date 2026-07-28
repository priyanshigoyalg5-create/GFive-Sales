'use client';

import React, { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

<div style={{ display: 'flex', gap: '10px', marginBottom: '16px', background: '#0f172a', padding: '10px 16px', borderRadius: '12px' }}>
  <a href="/admin/orders" style={{ color: '#94a3b8', textDecoration: 'none', fontWeight: '700', fontSize: '13px' }}>📊 Orders Dashboard</a>
  <a href="/admin/samples" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: '700', fontSize: '13px' }}>🛍️ All Samples</a>
  <a href="/admin/add" style={{ color: '#ffffff', textDecoration: 'none', fontWeight: '700', fontSize: '13px' }}>➕ Add Sample</a>
</div>

interface ColorRow {
  id: string;
  name: string;
  photoUrl: string;
  photoFile?: File | null;
}

interface SamplePhotoRow {
  id: string;
  file: File | null;
  preview: string | null;
}

export default function AddSamplePage() {
  const [loading, setLoading] = useState(false);
  const [designNumber, setDesignNumber] = useState('');
  const [price, setPrice] = useState('');
  const [fabric, setFabric] = useState('');
  const [work, setWork] = useState('');
  const [salesPerson, setSalesPerson] = useState('');

  // Sample Photos State
  const [samplePhotos, setSamplePhotos] = useState<SamplePhotoRow[]>([
    { id: '1', file: null, preview: null }
  ]);

  // Dynamic Colour Rows State
  const [colorRows, setColorRows] = useState<ColorRow[]>([
    { id: '1', name: '', photoUrl: '', photoFile: null }
  ]);

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdSampleUrl, setCreatedSampleUrl] = useState('');
  const [createdSampleData, setCreatedSampleData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const triggerToast = (text: string, type: 'error' | 'success' = 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sample Photo Row Functions
  const handleAddSamplePhoto = () => {
    setSamplePhotos((prev) => [
      ...prev,
      { id: Date.now().toString(), file: null, preview: null }
    ]);
  };

  const handleRemoveSamplePhoto = (id: string) => {
    if (samplePhotos.length === 1) {
      triggerToast('At least 1 sample photo is required!', 'error');
      return;
    }
    setSamplePhotos((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSamplePhotoChange = (id: string, fileSelected: File | null) => {
    if (!fileSelected) return;
    const localUrl = URL.createObjectURL(fileSelected);
    setSamplePhotos((prev) =>
      prev.map((item) => (item.id === id ? { ...item, file: fileSelected, preview: localUrl } : item))
    );
  };

  // Colour Row Functions
  const handleAddColorRow = () => {
    setColorRows((prev) => [
      ...prev,
      { id: Date.now().toString(), name: '', photoUrl: '', photoFile: null }
    ]);
  };

  const handleRemoveColorRow = (id: string) => {
    if (colorRows.length === 1) {
      triggerToast('At least 1 colour row is required!', 'error');
      return;
    }
    setColorRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleColorNameChange = (id: string, nameValue: string) => {
    setColorRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, name: nameValue } : row))
    );
  };

  const handleColorImageChange = (id: string, fileSelected: File | null) => {
    if (!fileSelected) return;
    const localPreviewUrl = URL.createObjectURL(fileSelected);
    setColorRows((prev) =>
      prev.map((row) => {
        if (row.id === id) {
          return { ...row, photoUrl: localPreviewUrl, photoFile: fileSelected };
        }
        return row;
      })
    );
  };

  const uploadToCloudinary = async (imageFile: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', imageFile);
    formData.append('upload_preset', 'textile_preset');
    formData.append('cloud_name', process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'jhddliu0');

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'jhddliu0'}/image/upload`,
      { method: 'POST', body: formData }
    );
    const data = await res.json();
    return data.secure_url || '';
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    const validSamplePhotos = samplePhotos.filter((p) => p.file !== null);
    if (validSamplePhotos.length === 0) {
      triggerToast('Please attach at least 1 sample photo!', 'error');
      return;
    }
    if (!designNumber) {
      triggerToast('Please enter Design Number!', 'error');
      return;
    }
    if (!price) {
      triggerToast('Please enter Price!', 'error');
      return;
    }
    if (!salesPerson.trim()) {
      triggerToast('Please enter Sales Person Name!', 'error');
      return;
    }

    const validColorRows = colorRows.filter((r) => r.name.trim() !== '');
    if (validColorRows.length === 0) {
      triggerToast('Please enter at least one colour name!', 'error');
      return;
    }

    setLoading(true);

    try {
      const uploadedSampleUrls = await Promise.all(
        validSamplePhotos.map(async (p) => {
          return await uploadToCloudinary(p.file!);
        })
      );

      const mainImageUrl = uploadedSampleUrls[0] || '';

      const processedColorDetails = await Promise.all(
        validColorRows.map(async (row) => {
          let finalPhotoUrl = '';

          if (row.photoFile) {
            const uploadedUrl = await uploadToCloudinary(row.photoFile);
            if (uploadedUrl) finalPhotoUrl = uploadedUrl;
          }

          return {
            name: row.name.trim(),
            photoUrl: finalPhotoUrl,
          };
        })
      );

      const validColorNames = processedColorDetails.map((c) => c.name);

      const samplePayload = {
        designNumber,
        price: Number(price),
        fabric,
        work,
        salesPerson: salesPerson.trim(),
        colors: validColorNames,
        colorDetails: processedColorDetails,
        imageUrl: mainImageUrl,
        sampleImages: uploadedSampleUrls,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'samples'), samplePayload);
      const productUrl = `${window.location.origin}/s/${docRef.id}`;

      setCreatedSampleUrl(productUrl);
      setCreatedSampleData({ ...samplePayload, id: docRef.id });
      setShowSuccessModal(true);
      triggerToast('Sample created successfully!', 'success');
    } catch (err: any) {
      console.error(err);
      triggerToast(err.message || 'Error creating sample', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(createdSampleUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareToWhatsApp = async () => {
    if (!createdSampleData || !createdSampleUrl) return;

    const message = `*Gfive -Kolkata*\n` +
      `*NEW UNSTITCHED SUIT SAMPLE*\n\n` +
      `*Design No:* ${createdSampleData.designNumber}\n` +
      `*Rate:* ₹${createdSampleData.price}/pc\n` +
      `*Fabric:* ${createdSampleData.fabric || 'N/A'}\n` +
      `*Work:* ${createdSampleData.work || 'N/A'}\n` +
      `*Sales Person:* ${createdSampleData.salesPerson || 'N/A'}\n\n` +
      `👇 *Click link to view details & place order:*\n` +
      `${createdSampleUrl}`;

    const mainFile = samplePhotos[0]?.file;

    if (navigator.share && mainFile) {
      try {
        await navigator.share({ text: message, files: [mainFile] });
        return;
      } catch (err) {
        console.log('Share canceled', err);
      }
    }

    window.location.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  };

  return (
    <div style={{
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      padding: '12px 0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ maxWidth: '460px', width: '100%', position: 'relative' }}>

        {/* TOAST BANNER */}
        {toastMessage && (
          <div style={{
            position: 'fixed',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: toastMessage.type === 'success' ? '#15803d' : '#dc2626',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '30px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
            fontSize: '14px',
            fontWeight: '600'
          }}>
            <span>{toastMessage.type === 'success' ? '✅' : '⚠️'} {toastMessage.text}</span>
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
            ✨
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0f172a' }}>Add Fabric Sample</h1>
            <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>Create dynamic sample link</p>
          </div>
        </div>

        {/* Form Container */}
        <div style={{
          background: '#ffffff',
          padding: '20px',
          borderRadius: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)'
        }}>
          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* SAMPLE PHOTOS SECTION */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', display: 'block', marginBottom: '8px' }}>
                Main Sample Photos *
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {samplePhotos.map((item, index) => (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 28px', gap: '8px', alignItems: 'center' }}>
                    <div style={{
                      position: 'relative',
                      minHeight: '100px',
                      borderRadius: '12px',
                      border: '1.5px dashed #0284c7',
                      background: '#f0f9ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      padding: '8px'
                    }}>
                      {item.preview ? (
                        <img 
                          src={item.preview} 
                          alt={`Sample ${index + 1}`} 
                          style={{ maxHeight: '160px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px' }} 
                        />
                      ) : (
                        <span style={{ fontSize: '13px', color: '#0284c7', fontWeight: '700' }}>
                          📷 Upload Sample Photo {index > 0 ? `#${index + 1}` : ''}
                        </span>
                      )}

                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleSamplePhotoChange(item.id, e.target.files?.[0] || null)}
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveSamplePhoto(item.id)}
                      style={{
                        background: '#ffffff',
                        color: '#dc2626',
                        border: '1px solid #fee2e2',
                        borderRadius: '8px',
                        height: '36px',
                        width: '28px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddSamplePhoto}
                style={{
                  marginTop: '10px',
                  background: '#f0f9ff',
                  color: '#0284c7',
                  border: '1.5px dashed #0284c7',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                ➕ Add Sample Photo
              </button>
            </div>

            {/* Design Number & Rate */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', display: 'block', marginBottom: '4px' }}>Design No *</label>
                <input
                  type="text"
                  placeholder="e.g. D-8042"
                  value={designNumber}
                  onChange={(e) => setDesignNumber(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14px', color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', display: 'block', marginBottom: '4px' }}>Rate (₹/pc) *</label>
                <input
                  type="number"
                  placeholder="185"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14px', color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Fabric & Work */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', display: 'block', marginBottom: '4px' }}>Fabric</label>
                <input
                  type="text"
                  placeholder="e.g. Cotton Slub"
                  value={fabric}
                  onChange={(e) => setFabric(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14px', color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', display: 'block', marginBottom: '4px' }}>Work</label>
                <input
                  type="text"
                  placeholder="e.g. Embroidery"
                  value={work}
                  onChange={(e) => setWork(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14px', color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* DYNAMIC COLOURS SECTION */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', display: 'block', marginBottom: '8px' }}>
                Available Colours & Photos
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 85px 28px', gap: '8px', marginBottom: '6px', fontSize: '12px', fontWeight: '700', color: '#64748b' }}>
                <span>Colour Name</span>
                <span style={{ textAlign: 'center' }}>Photo</span>
                <span></span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {colorRows.map((row) => (
                  <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1fr 85px 28px', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="e.g. Red, M1"
                      value={row.name}
                      onChange={(e) => handleColorNameChange(row.id, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '14px',
                        color: '#0f172a',
                        background: '#ffffff',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />

                    <div style={{
                      position: 'relative',
                      height: '42px',
                      borderRadius: '10px',
                      border: '1.5px dashed #0284c7',
                      background: '#f0f9ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      cursor: 'pointer'
                    }}>
                      {row.photoUrl ? (
                        <img src={row.photoUrl} alt={row.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: '700' }}>📷 + Photo</span>
                      )}

                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleColorImageChange(row.id, e.target.files?.[0] || null)}
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveColorRow(row.id)}
                      style={{
                        background: '#ffffff',
                        color: '#dc2626',
                        border: '1px solid #fee2e2',
                        borderRadius: '8px',
                        height: '36px',
                        width: '28px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddColorRow}
                style={{
                  marginTop: '10px',
                  background: '#f0f9ff',
                  color: '#0284c7',
                  border: '1.5px dashed #0284c7',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                ➕ Add Colour
              </button>
            </div>

            {/* Sales Person */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', display: 'block', marginBottom: '4px' }}>Sales Person *</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={salesPerson}
                onChange={(e) => setSalesPerson(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14px', color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: 'white',
                padding: '16px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '700',
                border: 'none',
                marginTop: '6px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)'
              }}
            >
              {loading ? 'Uploading Photos & Creating Link...' : 'Save Sample Link'}
            </button>
          </form>
        </div>

        {/* SUCCESS POPUP MODAL */}
        {showSuccessModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '20px'
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '24px',
              padding: '24px',
              width: '100%',
              maxWidth: '380px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              textAlign: 'center',
              position: 'relative'
            }}>
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                style={{
                  position: 'absolute',
                  top: '14px',
                  right: '14px',
                  background: '#f1f5f9',
                  border: 'none',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                ✕
              </button>

              <div style={{ width: '56px', height: '56px', background: '#dcfce7', color: '#16a34a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', margin: '0 auto 12px auto' }}>
                🎉
              </div>

              <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 6px 0', color: '#0f172a' }}>
                Sample Created!
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>
                Design <strong>#{createdSampleData?.designNumber}</strong> link generated with {createdSampleData?.sampleImages?.length || 1} sample photos.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  onClick={shareToWhatsApp}
                  style={{
                    width: '100%',
                    background: '#25D366',
                    color: 'white',
                    padding: '14px',
                    borderRadius: '12px',
                    fontWeight: '700',
                    border: 'none',
                    fontSize: '15px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  💬 Share directly to WhatsApp
                </button>

                <button
                  type="button"
                  onClick={copyToClipboard}
                  style={{
                    width: '100%',
                    background: '#f1f5f9',
                    color: '#0f172a',
                    padding: '12px',
                    borderRadius: '12px',
                    fontWeight: '600',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  📋 {copied ? 'Link Copied to Clipboard!' : 'Copy Link'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}