/** WhatsApp message builders (pure — no network). */
export type WaPayload = Record<string, unknown>;

export const clip = (s: unknown, n: number) => {
  const t = String(s ?? '');
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

export interface Btn {
  id: string;
  title: string;
}
export interface Row {
  id: string;
  title: string;
  description?: string;
}

/** Message builders (limits from Meta: 3 buttons × 20 chars, 10 list rows × 24 chars). */
export const P = {
  text: (body: string, preview = false): WaPayload => ({ type: 'text', text: { body: clip(body, 4096), preview_url: preview } }),
  buttons: (body: string, buttons: Btn[], opts: { footer?: string; imageUrl?: string } = {}): WaPayload => ({
    type: 'interactive',
    interactive: {
      type: 'button',
      ...(opts.imageUrl ? { header: { type: 'image', image: { link: opts.imageUrl } } } : {}),
      body: { text: clip(body, 1024) },
      ...(opts.footer ? { footer: { text: clip(opts.footer, 60) } } : {}),
      action: { buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: clip(b.id, 256), title: clip(b.title, 20) } })) },
    },
  }),
  list: (body: string, button: string, rows: Row[], opts: { header?: string; footer?: string; sectionTitle?: string } = {}): WaPayload => ({
    type: 'interactive',
    interactive: {
      type: 'list',
      ...(opts.header ? { header: { type: 'text', text: clip(opts.header, 60) } } : {}),
      body: { text: clip(body, 4096) },
      ...(opts.footer ? { footer: { text: clip(opts.footer, 60) } } : {}),
      action: {
        button: clip(button, 20),
        sections: [
          {
            title: clip(opts.sectionTitle || 'Select', 24),
            rows: rows.slice(0, 10).map((r) => ({ id: clip(r.id, 200), title: clip(r.title, 24), ...(r.description ? { description: clip(r.description, 72) } : {}) })),
          },
        ],
      },
    },
  }),
  image: (link: string, caption?: string): WaPayload => ({ type: 'image', image: { link, ...(caption ? { caption: clip(caption, 1024) } : {}) } }),
  video: (link: string, caption?: string): WaPayload => ({ type: 'video', video: { link, ...(caption ? { caption: clip(caption, 1024) } : {}) } }),
};
