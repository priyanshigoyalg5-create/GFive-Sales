import { verifyStaff } from '@/lib/verify-staff';
import { hasPermission } from '@/lib/permissions';
import { adminStore } from '@/lib/whatsapp/store-admin';
import { hasAdminCredentials } from '@/lib/server/firebase-admin';
import { publishFacebook, publishInstagram } from '@/lib/social/graph';
import { postCaption } from '@/lib/social/handler';
import { samplePhotos } from '@/lib/sample-photos';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Post one design (photo + caption) on the GFive Facebook page and/or @gfiveindia. */
export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
  const staff = await verifyStaff(token).catch(() => null);
  if (!staff || !hasPermission(staff.role as never, staff.permissions, 'socialPost')) return Response.json({ error: 'Posting is not enabled for your account.' }, { status: 403 });
  if (!hasAdminCredentials() || !process.env.META_PAGE_TOKEN) return Response.json({ error: 'Instagram / Facebook are not connected yet (Settings → Instagram & Facebook).' }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { sampleId?: string; photo?: string; instagram?: boolean; facebook?: boolean; caption?: string };
  if (!body.sampleId || (!body.instagram && !body.facebook)) return Response.json({ error: 'Choose Instagram and/or Facebook.' }, { status: 400 });
  const store = adminStore();
  const sample = (await store.samples()).find((s) => s.id === body.sampleId);
  if (!sample) return Response.json({ error: 'Design not found.' }, { status: 404 });
  const photos = samplePhotos(sample);
  const photo = body.photo && photos.includes(body.photo) ? body.photo : photos[0];
  if (!photo) return Response.json({ error: 'This design has no photo.' }, { status: 400 });
  // Instagram wants a public JPEG with ratio between 4:5 and 1.91:1
  const img = photo.includes('/upload/') ? photo.replace('/upload/', '/upload/w_1080,h_1350,c_pad,b_rgb:fbf5e9,f_jpg,q_85/') : photo;
  const [cfg, st] = await Promise.all([store.getSocialConfig(), store.getSettings()]);
  const caption = (body.caption || '').trim() || postCaption(sample, { showRate: cfg.showRate, siteUrl: '', company: st.companyName || 'GFive Kolkata' });

  const out: { instagram?: string; facebook?: string; errors: string[] } = { errors: [] };
  if (body.instagram) {
    try {
      out.instagram = await publishInstagram(img, caption);
    } catch (e) {
      out.errors.push(`Instagram: ${(e as Error).message}`);
    }
  }
  if (body.facebook) {
    try {
      out.facebook = await publishFacebook(img, caption);
    } catch (e) {
      out.errors.push(`Facebook: ${(e as Error).message}`);
    }
  }
  if (out.instagram || out.facebook) await store.savePost({ sampleId: sample.id, igMediaId: out.instagram || '', fbPostId: out.facebook || '', by: staff.name });
  return Response.json(out, { status: out.instagram || out.facebook ? 200 : 502 });
}
