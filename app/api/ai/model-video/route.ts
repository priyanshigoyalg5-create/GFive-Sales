import { verifyStaff } from '@/lib/verify-staff';
import { hasPermission } from '@/lib/permissions';
import { AiError, checkModelVideo, isOwnCloudinaryImage, isVideoOperation, startModelVideo } from '@/lib/ai-media';

export const runtime = 'nodejs';
export const maxDuration = 120;

async function staffOf(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
  const staff = await verifyStaff(token).catch(() => null);
  // AI video is a paid feature — only people allowed to use AI media
  return staff && hasPermission(staff.role as never, staff.permissions, 'aiMedia') ? staff : null;
}

function fail(err: unknown) {
  const e = err instanceof AiError ? err : new AiError('AI video is unavailable right now.');
  return Response.json({ error: e.message }, { status: e.status });
}

/** Start: { imageUrl } → { op } */
export async function POST(req: Request) {
  if (!(await staffOf(req))) return Response.json({ error: 'Please sign in again (or AI is not enabled for your account).' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { imageUrl?: unknown };
  if (!isOwnCloudinaryImage(body.imageUrl)) return Response.json({ error: 'Upload the photo first.' }, { status: 400 });
  try {
    return Response.json({ op: await startModelVideo(body.imageUrl) });
  } catch (err) {
    return fail(err);
  }
}

/** Poll: ?op=…[&extend=1] → { done:false, op? } | { done:true, url, extended } */
export async function GET(req: Request) {
  if (!(await staffOf(req))) return Response.json({ error: 'Please sign in again (or AI is not enabled for your account).' }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const op = params.get('op');
  if (!isVideoOperation(op)) return Response.json({ error: 'Bad request' }, { status: 400 });
  try {
    return Response.json(await checkModelVideo(op, params.get('extend') === '1'));
  } catch (err) {
    return fail(err);
  }
}
