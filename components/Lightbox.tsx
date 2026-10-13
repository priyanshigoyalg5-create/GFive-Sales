'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';
import { cldThumb } from '@/lib/format';

interface Props {
  images: string[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
  caption?: (i: number) => string | undefined;
}

/** Full-screen photo viewer: swipe / arrow keys to move, tap to zoom & pan. */
export default function Lightbox({ images, index, onClose, onIndexChange, caption }: Props) {
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const count = images.length;

  const go = useCallback(
    (d: number) => {
      setZoom(false);
      onIndexChange((index + d + count) % count);
    },
    [index, count, onIndexChange],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [go, onClose]);

  const setOriginFrom = (clientX: number, clientY: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * 100;
    const y = ((clientY - r.top) / r.height) * 100;
    setOrigin(`${Math.min(100, Math.max(0, x))}% ${Math.min(100, Math.max(0, y))}%`);
  };

  if (!count) return null;
  const cap = caption?.(index);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0d1709]/95 backdrop-blur-sm animate-fade-up" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between px-4 py-3 text-ivory/90">
        <span className="text-sm tracking-wide">
          {index + 1} / {count}
          {cap ? <span className="ml-3 text-gold-100">{cap}</span> : null}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => !z)}
            className="grid size-10 place-items-center rounded-full hover:bg-white/10"
            aria-label={zoom ? 'Zoom out' : 'Zoom in'}
          >
            {zoom ? <ZoomOut size={20} /> : <ZoomIn size={20} />}
          </button>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label="Close">
            <X size={22} />
          </button>
        </div>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden px-2"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          touch.current = { x: t.clientX, y: t.clientY, t: Date.now() };
        }}
        onTouchMove={(e) => {
          if (zoom) {
            const t = e.touches[0];
            setOriginFrom(t.clientX, t.clientY, e.currentTarget);
          }
        }}
        onTouchEnd={(e) => {
          const start = touch.current;
          touch.current = null;
          if (!start || zoom) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - start.x;
          const dy = t.clientY - start.y;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
          else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose();
        }}
        onMouseMove={(e) => zoom && setOriginFrom(e.clientX, e.clientY, e.currentTarget)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={images[index]}
          src={cldThumb(images[index], 1800, undefined, 'limit')}
          alt={cap || `Photo ${index + 1}`}
          onClick={(e) => {
            setOriginFrom(e.clientX, e.clientY, e.currentTarget.parentElement as HTMLElement);
            setZoom((z) => !z);
          }}
          className={`max-h-full max-w-full select-none object-contain transition-transform duration-200 ${zoom ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
          style={{ transform: zoom ? 'scale(2.4)' : 'none', transformOrigin: origin }}
          draggable={false}
        />

        {count > 1 && !zoom && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="Previous photo"
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="Next photo"
            >
              <ChevronRight />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 py-3">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => {
                setZoom(false);
                onIndexChange(i);
              }}
              className={`size-14 shrink-0 overflow-hidden rounded-lg border-2 transition ${i === index ? 'border-gold-400' : 'border-transparent opacity-50 hover:opacity-90'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cldThumb(src, 120, 120)} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
