/**
 * Meta Graph API for the Facebook Page + Instagram professional account.
 * Env: META_PAGE_ID, META_PAGE_TOKEN (long-lived Page token / system-user token with
 * pages_messaging, pages_manage_posts, pages_read_engagement, pages_manage_engagement,
 * instagram_basic, instagram_content_publish, instagram_manage_comments, instagram_manage_messages),
 * META_IG_USER_ID (Instagram professional account id), optional META_GRAPH_VERSION.
 *
 * No "server-only" import so tests can run it with a fake fetch.
 */
export type Platform = 'instagram' | 'facebook';

type Fetch = typeof fetch;
let fetchImpl: Fetch = (...a) => fetch(...a);
export function _setGraphFetch(f: Fetch) {
  fetchImpl = f;
}

const version = () => process.env.META_GRAPH_VERSION || 'v23.0';

export class GraphError extends Error {
  constructor(message: string, public status?: number, public code?: number) {
    super(message);
  }
}

export async function graph<T = Record<string, unknown>>(path: string, params: Record<string, unknown> = {}, method: 'GET' | 'POST' = 'POST'): Promise<T> {
  const token = process.env.META_PAGE_TOKEN;
  if (!token) throw new GraphError('META_PAGE_TOKEN is not set');
  const url = new URL(`https://graph.facebook.com/${version()}/${path}`);
  let body: string | undefined;
  if (method === 'GET') {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    url.searchParams.set('access_token', token);
  } else {
    body = JSON.stringify({ ...params, access_token: token });
  }
  const res = await fetchImpl(url.toString(), { method, headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined, body });
  const text = await res.text();
  let data: (T & { error?: { message?: string; code?: number } }) | null = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok || data?.error) throw new GraphError(data?.error?.message || `Graph ${res.status}`, res.status, data?.error?.code);
  return data as T;
}

const pageId = () => {
  const p = process.env.META_PAGE_ID;
  if (!p) throw new GraphError('META_PAGE_ID is not set');
  return p;
};
const igId = () => {
  const p = process.env.META_IG_USER_ID;
  if (!p) throw new GraphError('META_IG_USER_ID is not set');
  return p;
};

export interface QuickReply {
  title: string; // max 20 chars
  payload: string;
}

/** DM to an Instagram user (IGSID) or Messenger user (PSID) who wrote to us (24 h window). */
export function sendDM(platform: Platform, recipientId: string, text: string, quick: QuickReply[] = []) {
  return graph(`${pageId()}/messages`, {
    recipient: { id: recipientId },
    ...(platform === 'facebook' ? { messaging_type: 'RESPONSE' } : {}),
    message: {
      text: text.slice(0, 1000),
      ...(quick.length ? { quick_replies: quick.slice(0, 13).map((q) => ({ content_type: 'text', title: q.title.slice(0, 20), payload: q.payload })) } : {}),
    },
  });
}

/** Image in a DM. */
export function sendDMImage(platform: Platform, recipientId: string, url: string) {
  return graph(`${pageId()}/messages`, {
    recipient: { id: recipientId },
    ...(platform === 'facebook' ? { messaging_type: 'RESPONSE' } : {}),
    message: { attachment: { type: 'image', payload: { url, is_reusable: true } } },
  });
}

/** One private DM to someone who commented (within 7 days). */
export function privateReply(commentId: string, text: string) {
  return graph(`${pageId()}/messages`, { recipient: { comment_id: commentId }, message: { text: text.slice(0, 1000) } });
}

/** Short public reply under the comment. */
export function publicReply(platform: Platform, commentId: string, text: string) {
  return platform === 'instagram' ? graph(`${commentId}/replies`, { message: text }) : graph(`${commentId}/comments`, { message: text });
}

/** Name of the person (best effort). */
export async function profileName(platform: Platform, userId: string): Promise<{ name: string; handle: string }> {
  try {
    if (platform === 'instagram') {
      const d = await graph<{ name?: string; username?: string }>(userId, { fields: 'name,username' }, 'GET');
      return { name: d.name || d.username || '', handle: d.username ? `@${d.username}` : '' };
    }
    const d = await graph<{ first_name?: string; last_name?: string; name?: string }>(userId, { fields: 'first_name,last_name,name' }, 'GET');
    return { name: d.name || [d.first_name, d.last_name].filter(Boolean).join(' '), handle: '' };
  } catch {
    return { name: '', handle: '' };
  }
}

/** Instagram: create the photo container, then publish it. Returns the media id. */
export async function publishInstagram(imageUrl: string, caption: string): Promise<string> {
  const c = await graph<{ id: string }>(`${igId()}/media`, { image_url: imageUrl, caption: caption.slice(0, 2200) });
  const p = await graph<{ id: string }>(`${igId()}/media_publish`, { creation_id: c.id });
  return p.id;
}

/** Facebook Page photo post. Returns the post id. */
export async function publishFacebook(imageUrl: string, caption: string): Promise<string> {
  const d = await graph<{ id: string; post_id?: string }>(`${pageId()}/photos`, { url: imageUrl, message: caption.slice(0, 5000), published: true });
  return d.post_id || d.id;
}

export const ownIds = () => [process.env.META_PAGE_ID, process.env.META_IG_USER_ID].filter(Boolean) as string[];
