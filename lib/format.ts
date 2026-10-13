/** ₹1,23,456 style formatting (Indian grouping). */
export function inr(value: number | string | undefined | null, opts: { decimals?: boolean } = {}): string {
  const n = Number(value || 0);
  return (
    '₹' +
    n.toLocaleString('en-IN', {
      minimumFractionDigits: opts.decimals ? 2 : 0,
      maximumFractionDigits: opts.decimals ? 2 : 0,
    })
  );
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`;
}
function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', r ? twoDigits(r) : ''].filter(Boolean).join(' ');
}

/** 13965 -> "Rupees Thirteen Thousand Nine Hundred Sixty Five Only" (Indian system). */
export function amountInWords(amount: number): string {
  let n = Math.floor(Math.abs(Number(amount) || 0));
  if (n === 0) return 'Rupees Zero Only';
  const parts: string[] = [];
  const crore = Math.floor(n / 1_00_00_000);
  n %= 1_00_00_000;
  const lakh = Math.floor(n / 1_00_000);
  n %= 1_00_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${crore > 99 ? threeDigits(crore) : twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return `Rupees ${parts.join(' ')} Only`;
}

/** Cloudinary on-the-fly resize. Leaves non-Cloudinary URLs untouched. */
export function cldThumb(url: string | undefined, w: number, h?: number, crop: 'fill' | 'fit' | 'limit' = 'fill'): string {
  if (!url) return '';
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  const t = [`w_${w}`, h ? `h_${h}` : '', `c_${crop}`, 'q_auto', 'f_auto'].filter(Boolean).join(',');
  return url.replace('/upload/', `/upload/${t}/`);
}

export function formatDate(d: Date | null | undefined, withTime = false): string {
  if (!d) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function tsToDate(ts: unknown): Date | null {
  if (ts && typeof ts === 'object' && 'toDate' in ts && typeof (ts as { toDate: unknown }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate();
  }
  return null;
}

export function digitsOnly(s: string): string {
  return (s || '').replace(/\D/g, '');
}
