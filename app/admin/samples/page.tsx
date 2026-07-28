'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AddSamplePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [designNumber, setDesignNumber] = useState('');
  const [price, setPrice] = useState('');
  const [fabric, setFabric] = useState('');
  const [work, setWork] = useState('');
  const [remarks, setRemarks] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [colors, setColors] = useState<string[]>([]);
  const [newColorName, setNewColorName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);

  // Agar edit mode hai toh purana data fetch karke form mein pre-fill karo
  useEffect(() => {
    if (!editId) return;
    async function fetchSampleData() {
      try {
        const docRef = doc(db, 'samples', editId as string);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setDesignNumber(data.designNumber || '');
          setPrice(data.price || '');
          setFabric(data.fabric || '');
          setWork(data.work || '');
          setRemarks(data.remarks || '');
          setImageUrl(data.imageUrl || '');
          setColors(data.colors || []);
        }
      } catch (err) {
        console.error('Error fetching sample for edit:', err);
      } finally {
        setLoadingEdit(false);
      }
    }
    fetchSampleData();
  }, [editId]);

  const handleAddColor = () => {
    if (!newColorName.trim()) return;
    if (!colors.includes(newColorName.trim())) {
      setColors([...colors, newColorName.trim()]);
    }
    setNewColorName('');
  };

  const handleRemoveColor = (colName: string) => {
    setColors(colors.filter((c) => c !== colName));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!designNumber || !price || !imageUrl) {
      alert('Please fill Design Number, Price, and Image URL!');
      return;
    }

    setSaving(true);
    try {
      if (editId) {
        // Update existing sample
        const docRef = doc(db, 'samples', editId);
        await updateDoc(docRef, {
          designNumber,
          price: Number(price),
          fabric,
          work,
          remarks,
          imageUrl,
          colors,
          updatedAt: serverTimestamp(),
        });
        alert('Sample updated successfully!');
      } else {
        // Create new sample
        await addDoc(collection(db, 'samples'), {
          designNumber,
          price: Number(price),
          fabric,
          work,
          remarks,
          imageUrl,
          colors,
          createdAt: serverTimestamp(),
        });
        alert('Sample added successfully!');
      }
      router.push('/admin/samples'); // Aap apne samples list page ka route yahan adjust kar sakte hain
    } catch (err) {
      console.error('Error saving sample:', err);
      alert('Failed to save sample.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingEdit) {
    return <div style={{ padding: '60px', textAlign: 'center', fontWeight: 'bold' }}>Loading sample data for editing...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '30px 16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', background: '#ffffff', padding: '30px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
        
        <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginBottom: '20px' }}>
          {editId ? `✏️ Edit Design #${designNumber}` : '➕ Add New Fabric Sample'}
        </h1>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Design Number *</label>
            <input
              type="text"
              placeholder="e.g. SD11070"
              value={designNumber}
              onChange={(e) => setDesignNumber(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Price (₹ / pc) *</label>
            <input
              type="number"
              placeholder="e.g. 2995"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Fabric Name</label>
            <input
              type="text"
              placeholder="e.g. Mul Chandari"
              value={fabric}
              onChange={(e) => setFabric(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Work Type</label>
            <input
              type="text"
              placeholder="e.g. Katha mirror"
              value={work}
              onChange={(e) => setWork(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Image URL *</label>
            <input
              type="text"
              placeholder="Paste Image URL here"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Remarks</label>
            <input
              type="text"
              placeholder="Optional notes"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>Colours Available</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                type="text"
                placeholder="Color name"
                value={newColorName}
                onChange={(e) => setNewColorName(e.target.value)}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
              />
              <button type="button" onClick={handleAddColor} style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                Add Color
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {colors.map((col) => (
                <span key={col} style={{ background: '#e2e8f0', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {col}
                  <button type="button" onClick={() => handleRemoveColor(col)} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 'bold', cursor: 'pointer' }}>×</button>
                </span>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              background: '#2563eb',
              color: '#ffffff',
              padding: '14px',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '800',
              border: 'none',
              marginTop: '10px',
              cursor: 'pointer'
            }}
          >
            {saving ? 'Saving...' : editId ? '💾 Update Sample' : '🚀 Save & Publish Sample'}
          </button>

        </form>

      </div>
    </div>
  );
}