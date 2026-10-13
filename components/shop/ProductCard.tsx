'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import type { Sample } from '@/lib/types';
import { cldThumb, inr } from '@/lib/format';
import { sampleColors, samplePhotos } from '@/lib/samples';
import { collectionName } from '@/lib/collections';

export default function ProductCard({ sample, inCartPcs = 0 }: { sample: Sample; inCartPcs?: number }) {
  const photos = samplePhotos(sample);
  const colors = sampleColors(sample);
  const cover = photos[0];
  const hover = photos[1];

  return (
    <Link href={`/s/${sample.id}`} className="group block animate-fade-up">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-sand">
        {cover ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cldThumb(cover, 600, 750)}
              alt={`Design ${sample.designNumber}`}
              loading="lazy"
              className="size-full object-cover transition duration-700 group-hover:scale-[1.04]"
            />
            {hover && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={cldThumb(hover, 600, 750)}
                alt=""
                loading="lazy"
                className="absolute inset-0 size-full object-cover opacity-0 transition duration-500 group-hover:opacity-100"
              />
            )}
          </>
        ) : (
          <div className="grid size-full place-items-center text-muted">No photo</div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />
        {photos.length > 1 && (
          <span className="absolute bottom-2.5 left-2.5 rounded-full bg-black/45 px-2 py-0.5 text-[11px] text-white backdrop-blur">
            {photos.length} photos
          </span>
        )}
        {collectionName(sample.collection) && !inCartPcs && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-ivory/90 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-leaf-800 backdrop-blur">
            {collectionName(sample.collection)}
          </span>
        )}
        {inCartPcs > 0 && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-leaf-700 px-2.5 py-1 text-[11px] font-medium text-ivory shadow">
            <Check size={12} /> {inCartPcs} in cart
          </span>
        )}
      </div>

      <div className="px-1 pt-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-[19px] font-semibold leading-tight text-ink">#{sample.designNumber}</h3>
          <p className="shrink-0 text-[15px] font-semibold text-leaf-700">
            {inr(sample.price)}
            <span className="text-xs font-normal text-muted">/pc</span>
          </p>
        </div>
        {(sample.fabric || sample.work) && (
          <p className="mt-0.5 line-clamp-1 text-[13px] text-muted">{[sample.fabric, sample.work].filter(Boolean).join(' · ')}</p>
        )}
        {colors.length > 0 && (
          <p className="mt-1.5 line-clamp-1 text-[12px] tracking-wide text-gold-600">
            {colors.length} colour{colors.length > 1 ? 's' : ''} · {colors.map((c) => c.name).join(', ')}
          </p>
        )}
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[4/5] rounded-2xl bg-sand" />
      <div className="mt-3 h-5 w-2/3 rounded bg-sand" />
      <div className="mt-2 h-4 w-1/2 rounded bg-sand" />
    </div>
  );
}
