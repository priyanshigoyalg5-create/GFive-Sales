import { verifyStaff } from '@/lib/verify-staff';
import { hasPermission } from '@/lib/permissions';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, hasAdminCredentials } from '@/lib/server/firebase-admin';
import { gstOnlineReady, verifyGstOnline } from '@/lib/server/gst-verify';
import { checkGstin, namesMatch, type GstCheck } from '@/lib/gst';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST { leadId } — checks the lead's GST number online and saves the result on the lead.
 * Lead managers: any lead. Others: only leads given to them. One paid call per GSTIN
 * (results are kept in gstChecks/<GSTIN> for 30 days).
 */
export async function GET() {
  return Response.json({ online: gstOnlineReady() && hasAdminCredentials() });
}

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
  const staff = await verifyStaff(token).catch(() => null);
  if (!staff) return Response.json({ error: 'Please sign in again.' }, { status: 401 });
  if (!gstOnlineReady() || !hasAdminCredentials()) return Response.json({ error: 'Online GST check is not set up yet (Cashfree keys on Vercel).' }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { leadId?: string };
  if (!body.leadId || !/^[A-Za-z0-9]+$/.test(body.leadId)) return Response.json({ error: 'Lead missing.' }, { status: 400 });

  const db = adminDb();
  const ref = db.doc(`leads/${body.leadId}`);
  const snap = await ref.get();
  if (!snap.exists) return Response.json({ error: 'Lead not found.' }, { status: 404 });
  const lead = snap.data() as { gstin?: string; name?: string; firm?: string; assignedUid?: string };
  if (!hasPermission(staff.role as never, staff.permissions, 'manageLeads') && lead.assignedUid !== staff.uid) return Response.json({ error: 'Not your lead.' }, { status: 403 });
  const info = checkGstin(lead.gstin);
  if (!info.ok) return Response.json({ error: info.reason || 'Wrong GST number' }, { status: 400 });

  const names = [lead.firm || '', lead.name || ''];
  const cacheRef = db.doc(`gstChecks/${info.gstin}`);
  const cached = (await cacheRef.get()).data() as GstCheck | undefined;
  let check: GstCheck;
  if (cached && Date.now() - cached.at < 30 * 86_400_000) {
    check = { ...cached, nameMatch: cached.found && namesMatch(names, [cached.legalName, cached.tradeName]) };
  } else {
    try {
      check = await verifyGstOnline(info.gstin, names);
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 502 });
    }
    await cacheRef.set({ ...check, by: staff.name });
  }
  await ref.set({ gstCheck: check, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return Response.json({ check });
}
