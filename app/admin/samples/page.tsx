'use client';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';

export default function AllSamplesPage() {
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'samples'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setSamples(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDeleteSample = async (sampleId: string, designNo: string) => {
    if (confirm(`Are you sure you want to delete Design #${designNo}? This link will stop working.`)) {
      try {
        await deleteDoc(doc(db, 'samples', sampleId));
        alert('Sample deleted successfully.');
      } catch (err) {
        console.error(err);
        alert('Failed to delete sample.');
      }
    }
  };

  const filteredSamples = samples.filter((s) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      String(s.designNumber || '').toLowerCase().includes(q) ||
      String(s.fabric || '').toLowerCase().includes(q) ||
      String(s.work || '').toLowerCase().includes(q)
    );
  });

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
              Shopping style catalog of all design samples created by Admin ({samples.length} items)
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

        {/* Search Bar */}
        <div style={{ marginBottom: '24px' }}>
          <input
            type="text"
            placeholder="Search by Design No, Fabric or Work..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 18px',
              borderRadius: '14px',
              border: '2px solid #cbd5e1',
              fontSize: '15px',
              fontWeight: '600',
              background: '#ffffff',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

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

              return (
                <div 
                  key={sample.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '20px',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    {/* Main Image */}
                    <div style={{ position: 'relative', width: '100%', height: '260px', background: '#f1f5f9' }}>
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
                  <div style={{ padding: '16px', paddingTop: 0, display: 'flex', gap: '8px' }}>
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
                      🔗 Open Link
                    </a>

                    <button
                      type="button"
                      onClick={() => handleDeleteSample(sample.id, sample.designNumber)}
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