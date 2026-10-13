import { verifyStaff } from '@/lib/verify-staff';
import { hasPermission } from '@/lib/permissions';
import { AiError, generateModelPhoto, isOwnCloudinaryImage, type Background } from '@/lib/ai-media';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Sales Person only: turns a suit photo into an AI model photo. */
export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
  const staff = await verifyStaff(token).catch(() => null);
  if (!staff) return Response.json({ error: 'Please sign in again.' }, { status: 401 });
  if (!hasPermission(staff.role as never, staff.permissions, 'aiMedia')) return Response.json({ error: 'AI photos & videos are not enabled for your account.' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { imageUrl?: unknown; background?: Background; notes?: string };
  if (!isOwnCloudinaryImage(body.imageUrl)) return Response.json({ error: 'Upload the photo first.' }, { status: 400 });
  try {
    const url = await generateModelPhoto(body.imageUrl, { background: body.background, notes: typeof body.notes === 'string' ? body.notes : '' });
    return Response.json({ url });
  } catch (err) {
    const e = err instanceof AiError ? err : new AiError('AI could not create the photo right now.');
    return Response.json({ error: e.message }, { status: e.status });
  }
}
