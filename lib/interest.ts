/**
 * First-party interest signals: which GFive designs this phone has looked at and on how
 * many days. Kept only in the customer's own browser (localStorage) and sent to us only
 * together with an enquiry / call-back they submit. No cookies, no third-party tracking.
 */
const KEY = 'gf_interest';

interface Stored {
  d: string[]; // design ids seen (last 50)
  days: string[]; // yyyy-mm-dd of visits (last 30)
  first: number; // ms
}

export interface Interest {
  designs: number; // different designs seen
  visits: number; // different days they came
  firstSeen: number; // ms
}

function read(): Stored | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return v && Array.isArray(v.d) && Array.isArray(v.days) ? (v as Stored) : null;
  } catch {
    return null;
  }
}

/** Call on every page view of the customer site (designId when it is a design page). */
export function noteVisit(designId?: string, now = Date.now()) {
  try {
    const s = read() || { d: [], days: [], first: now };
    const day = new Date(now).toISOString().slice(0, 10);
    if (!s.days.includes(day)) s.days = [...s.days, day].slice(-30);
    if (designId && !s.d.includes(designId)) s.d = [...s.d, designId].slice(-50);
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode — fine */
  }
}

export function readInterest(): Interest | null {
  const s = read();
  return s ? { designs: s.d.length, visits: s.days.length, firstSeen: s.first || 0 } : null;
}
