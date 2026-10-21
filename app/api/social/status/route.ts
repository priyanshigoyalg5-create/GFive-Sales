import { verifyStaff } from '@/lib/verify-staff';
import { hasPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/** Which Instagram / Facebook settings exist on the server (never their values). */
export async function GET(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
  const staff = await verifyStaff(token).catch(() => null);
  if (!staff || !(hasPermission(staff.role as never, staff.permissions, 'settings') || hasPermission(staff.role as never, staff.permissions, 'socialPost')))
    return Response.json({ error: 'Not allowed' }, { status: 403 });
  const has = (k: string) => !!process.env[k];
  return Response.json({
    FIREBASE_SERVICE_ACCOUNT: has('FIREBASE_SERVICE_ACCOUNT'),
    META_PAGE_ID: has('META_PAGE_ID'),
    META_PAGE_TOKEN: has('META_PAGE_TOKEN'),
    META_IG_USER_ID: has('META_IG_USER_ID'),
    META_APP_SECRET: has('META_APP_SECRET') || has('WA_APP_SECRET'),
    META_VERIFY_TOKEN: has('META_VERIFY_TOKEN'),
  });
}
