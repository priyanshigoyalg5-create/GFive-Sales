import { verifyStaff } from '@/lib/verify-staff';
import { hasPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/** Which WhatsApp settings exist on the server (never their values). Settings power only. */
export async function GET(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
  const staff = await verifyStaff(token).catch(() => null);
  if (!staff || !hasPermission(staff.role as never, staff.permissions, 'settings')) return Response.json({ error: 'Not allowed' }, { status: 403 });
  const has = (k: string) => !!process.env[k];
  return Response.json({
    WA_TOKEN: has('WA_TOKEN'),
    WA_PHONE_NUMBER_ID: has('WA_PHONE_NUMBER_ID'),
    WA_APP_SECRET: has('WA_APP_SECRET'),
    WA_VERIFY_TOKEN: has('WA_VERIFY_TOKEN'),
    FIREBASE_SERVICE_ACCOUNT: has('FIREBASE_SERVICE_ACCOUNT'),
  });
}
