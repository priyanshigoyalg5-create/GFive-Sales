'use client';

import { Minus, Plus } from 'lucide-react';

export default function QtyStepper({
  value,
  onChange,
  size = 'md',
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: 'sm' | 'md';
  label?: string;
}) {
  const h = size === 'sm' ? 'h-9' : 'h-11';
  const btn = size === 'sm' ? 'w-9' : 'w-11';
  return (
    <div className={`inline-flex ${h} items-stretch overflow-hidden rounded-full border ${value > 0 ? 'border-leaf-600 bg-leaf-50' : 'border-line bg-white'} transition`}>
      <button
        type="button"
        aria-label={`Decrease ${label ?? ''}`}
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        className={`${btn} grid place-items-center text-leaf-800 hover:bg-leaf-100 disabled:text-muted/40 disabled:hover:bg-transparent`}
      >
        <Minus size={16} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        aria-label={`Quantity ${label ?? ''}`}
        value={value === 0 ? '' : value}
        placeholder="0"
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          onChange(Number.isNaN(n) ? 0 : Math.max(0, Math.min(9999, n)));
        }}
        className={`w-12 bg-transparent text-center text-[17px] font-semibold text-ink outline-none placeholder:text-muted/50 ${size === 'sm' ? 'w-10 text-sm' : ''}`}
      />
      <button
        type="button"
        aria-label={`Increase ${label ?? ''}`}
        onClick={() => onChange(value + 1)}
        className={`${btn} grid place-items-center text-leaf-800 hover:bg-leaf-100`}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
