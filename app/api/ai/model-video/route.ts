import { verifyStaff } from '@/lib/verify-staff';
import { AiError, checkModelVideo, isOwnCloudinaryImage, isVideoOperation, startModelVideo } from '@/lib/ai-media';

export const runtime = 'nodejs';
export const maxDuration = 120;

async function staffOf(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
  return verifyStaff(token).catch(() => null);
}

function fail(err: unknown) {
  const e = err instanceof AiError ? err : new AiError('AI video is unavailable right now.');
  return Response.json({ error: e.message }, { status: e.status });
}

/** Start: { imageUrl } → { op } */
export async function POST(req: Request) {
  if (!(await staffOf(req))) return Response.json({ error: 'Please sign in again.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { imageUrl?: unknown };
  if (!isOwnCloudinaryImage(body.imageUrl)) return Response.json({ error: 'Upload the photo first.' }, { status: 400 });
  try {
    return Response.json({ op: await startModelVideo(body.imageUrl) });
  } catch (err) {
    return fail(err);
  }
}

/** Poll: ?op=… → { done:false } | { done:true, url } */
export async function GET(req: Request) {
  if (!(await staffOf(req))) return Response.json({ error: 'Please sign in again.' }, { status: 401 });
  const op = new URL(req.url).searchParams.get('op');
  if (!isVideoOperation(op)) return Response.json({ error: 'Bad request' }, { status: 400 });
  try {
    return Response.json(await checkModelVideo(op));
  } catch (err) {
    return fail(err);
  }
}
