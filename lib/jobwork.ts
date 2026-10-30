/**
 * GFive Job-Work (production) app — shared bits used by the GFive Sales website.
 * The Job Work app itself is a static page at /production (source: production/app/index.html);
 * its data lives in the same Firebase project in collections named jw_*.
 */

/** Mobile numbers that are always Job Work super admins (env NEXT_PUBLIC_JW_BOOT_PHONES, "+91…,+91…"; same list as jwBoot() in firestore.rules). */
export const JW_BOOT = (process.env.NEXT_PUBLIC_JW_BOOT_PHONES || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);

export interface JwUser {
  phone: string;
  name: string;
  role: string; // super | sub | admin | staff
  perms: Record<string, unknown>;
}

export const jwCan = (u: JwUser | null, p: string) => !!u && (u.role === 'super' || !!u.perms?.[p]);
