'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';

export default function AllSamplesPage() {
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Active' | 'Trash'>('Active');
  const [selectedSampleIds, setSelectedSampleIds] = useState<string[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'samples'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setSamples(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching samples: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleMoveToTrash = async (sampleId: string) => {
    try {
      const docRef = doc(db, 'samples', sampleId);
      await updateDoc(docRef, { isTrashed: true });
    } catch (err) {
      console.error('Failed to move to trash:', err);
      alert('Failed to move sample to trash.');
    }
  };

  const handleRestoreFromTrash = async (sampleId: string) => {
    try {
      const docRef = doc(db, 'samples', sampleId);
      await updateDoc(docRef, { isTrashed: false });
    } catch (err) {
      console.error('Failed to restore sample:', err);
      alert('Failed to restore sample.');
    }
  };

  const handlePermanentDelete = async (sampleId: string, designNo: string) => {
    if (confirm(`⚠️ Permanently delete Design #${designNo}? This cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, 'samples', sampleId));
      } catch (err) {
        console.error('Failed to permanently delete sample:', err);
        alert('Failed to delete sample.');
      }
    }
  };

  const toggleSelectSample = (id: string) => {
    setSelectedSampleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (filteredIds: string[]) => {
    const allSelected = filteredIds.every((id) => selectedSampleIds.includes(id));
    if (allSelected) {
      setSelectedSampleIds([]);
    } else {
      setSelectedSampleIds(filteredIds);
    }
  };

  const handleBulkMoveToTrash = async () => {
    if (selectedSampleIds.length === 0) return;
    if (confirm(`Move ${selectedSampleIds.length} selected sample(s) to Trash?`)) {
      try {
        const batch = writeBatch(db);
        selectedSampleIds.forEach((id) => {
          const docRef = doc(db, 'samples', id);
          batch.update(docRef, { isTrashed: true });
        });
        await batch.commit();
        setSelectedSampleIds([]);
      } catch (err) {
        console.error('Bulk trash failed:', err);
      }
    }
  };

  const handleBulkRestore = async () => {
    if (selectedSampleIds.length === 0) return;
    try {
      const batch = writeBatch(db);
      selectedSampleIds.forEach((id) => {
        const docRef = doc(db, 'samples', id);
        batch.update(docRef, { isTrashed: false });
      });
      await batch.commit();
      setSelectedSampleIds([]);
    } catch (err) {
      console.error('Bulk restore failed:', err);
    }
  };

  const handleBulkPermanentDelete = async () => {
    if (selectedSampleIds.length === 0) return;
    if (confirm(`⚠️ Permanently delete ${selectedSampleIds.length} selected sample(s)?`)) {
      try {
        const batch = writeBatch(db);
        selectedSampleIds.forEach((id) => {
          const docRef = doc(db, 'samples', id);
          batch.delete(docRef);
        });
        await batch.commit();
        setSelectedSampleIds([]);
      } catch (err) {
        console.error('Bulk delete failed:', err);
      }
    }
  };

  const filteredSamples = samples.filter((s) => {
    const isTrashed = !!s.isTrashed;
    if (statusFilter === 'Trash' && !isTrashed) return false;
    if (statusFilter === 'Active' && isTrashed) return false;

    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      String(s.designNumber || '').toLowerCase().includes(q) ||
      String(s.fabric || '').toLowerCase().includes(q) ||
      String(s.work || '').toLowerCase().includes(q)
    );
  });

  const filteredSampleIds = filteredSamples.map((s) => s.id);
  const isAllFilteredSelected = filteredSampleIds.length > 0 && filteredSampleIds.every((id) => selectedSampleIds.includes(id));
  const trashCount = samples.filter((s) => !!s.isTrashed).length;
  const activeCount = samples.filter((s) => !s.isTrashed).length;

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: '#0f172a', fontWeight: 'bold' }}>Loading All Uploaded Samples...</div>;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '24px 16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              🛍️ All Uploaded Fabric Samples
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Shopping style catalog of all design samples created by Admin ({activeCount} active items)
            </p>
          </div>

          <a 
            href="/admin/add" 
            style={{
              background: '#2563eb',
              color: '#ffffff',
              padding: '10px 18px',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '14px',
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
            }}
          >
            ➕ Add New Sample
          </a>
        </div>

        {/* Search & Status Filters */}
        <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: '1 1 300px' }}>
            <input
              type="text"
              placeholder="Search by Design No, Fabric or Work..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: '14px',
                border: '2px solid #cbd5e1',
                fontSize: '14px',
                fontWeight: '600',
                background: '#ffffff',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => { setStatusFilter('Active'); setSelectedSampleIds([]); }}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                background: statusFilter === 'Active' ? '#0f172a' : '#f1f5f9',
                color: statusFilter === 'Active' ? '#ffffff' : '#475569'
              }}
            >
              📂 Active ({activeCount})
            </button>
            <button
              onClick={() => { setStatusFilter('Trash'); setSelectedSampleIds([]); }}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                background: statusFilter === 'Trash' ? '#dc2626' : '#f1f5f9',
                color: statusFilter === 'Trash' ? '#ffffff' : '#dc2626'
              }}
            >
              🗑️ Trash ({trashCount})
            </button>
          </div>
        </div>

        {/* Bulk Selection Bar */}
        {filteredSamples.length > 0 && (
          <div style={{ background: '#ffffff', padding: '12px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
              <input
                type="checkbox"
                checked={isAllFilteredSelected}
                onChange={() => handleSelectAll(filteredSampleIds)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563eb' }}
              />
              Select All Shown ({filteredSamples.length})
            </label>

            {selectedSampleIds.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#2563eb', background: '#dbeafe', padding: '4px 10px', borderRadius: '6px' }}>
                  {selectedSampleIds.length} Selected
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

        {/* Shopping Catalog Grid */}
        {filteredSamples.length === 0 ? (
          <div style={{ background: '#ffffff', padding: '40px', borderRadius: '20px', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
            No samples found matching your search.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '20px'
          }}>
            {filteredSamples.map((sample) => {
              const allPhotos = sample.sampleImages && sample.sampleImages.length > 0 ? sample.sampleImages : [sample.imageUrl];
              const isSelected = selectedSampleIds.includes(sample.id);
              const isTrashed = !!sample.isTrashed;

              return (
                <div 
                  key={sample.id}
                  style={{
                    background: isSelected ? '#eff6ff' : '#ffffff',
                    borderRadius: '20px',
                    border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    overflow: 'hidden',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    opacity: isTrashed ? 0.75 : 1,
                    position: 'relative'
                  }}
                >
                  <div>
                    {/* Main Image with Checkbox */}
                    <div style={{ position: 'relative', width: '100%', height: '260px', background: '#f1f5f9' }}>
                      <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 10 }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectSample(sample.id)}
                          style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#2563eb' }}
                        />
                      </div>

                      <img 
                        src={sample.imageUrl} 
                        alt={sample.designNumber} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                      <span style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: '#15803d',
                        color: '#ffffff',
                        padding: '4px 10px',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: '800'
                      }}>
                        ₹{sample.price} / pc
                      </span>

                      {allPhotos.length > 1 && (
                        <span style={{
                          position: 'absolute',
                          bottom: '12px',
                          left: '12px',
                          background: 'rgba(15, 23, 42, 0.8)',
                          color: '#ffffff',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700'
                        }}>
                          📷 {allPhotos.length} Photos
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ padding: '16px' }}>
                      <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 8px 0', color: '#0f172a' }}>
                        Design #{sample.designNumber}
                      </h2>

                      <div style={{ fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {sample.fabric && <div><strong>Fabric:</strong> {sample.fabric}</div>}
                        {sample.work && <div><strong>Work:</strong> {sample.work}</div>}
                        {sample.remarks && <div style={{ color: '#64748b', fontStyle: 'italic', fontSize: '12px' }}>{sample.remarks}</div>}
                      </div>

                      {/* Colours */}
                      {sample.colors && sample.colors.length > 0 && (
                        <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {sample.colors.map((col: string) => (
                            <span key={col} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#0f172a', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                              {col}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ padding: '16px', paddingTop: 0, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {isTrashed ? (
                      <>
                        <button 
                          onClick={() => handleRestoreFromTrash(sample.id)}
                          style={{ flex: 1, background: '#16a34a', color: '#ffffff', border: 'none', padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          🔄 Restore
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePermanentDelete(sample.id, sample.designNumber)}
                          style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          💥 Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <a 
                          href={`/s/${sample.id}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            flex: 1,
                            background: '#0f172a',
                            color: '#ffffff',
                            padding: '10px',
                            borderRadius: '10px',
                            fontSize: '13px',
                            fontWeight: '700',
                            textDecoration: 'none',
                            textAlign: 'center'
                          }}
                        >
                          🔗 Link
                        </a>

                        <a 
                          href={`/admin/add?edit=${sample.id}`}
                          style={{
                            background: '#e0e7ff',
                            color: '#3730a3',
                            border: '1px solid #c7d2fe',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            fontSize: '13px',
                            fontWeight: '700',
                            textDecoration: 'none',
                            textAlign: 'center'
                          }}
                        >
                          ✏️ Edit
                        </a>

                        <button
                          type="button"
                          onClick={() => handleMoveToTrash(sample.id)}
                          style={{
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fca5a5',
                            padding: '10px',
                            borderRadius: '10px',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}