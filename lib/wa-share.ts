'use client';

/**
 * WhatsApp sending helpers.
 *
 * WhatsApp's chat links (api.whatsapp.com/send?phone=…&text=…) can only prefill TEXT.
 * The only way a web page can put a PHOTO into a WhatsApp message is the phone's
 * share sheet (Web Share API with files) — the user then taps the chat to send to.
 * On computers we copy the photo to the clipboard and open the chat so it can be
 * pasted with Ctrl+V.
 */

function jpgUrl(url: string, w = 1400) {
  return url.includes('res.cloudinary.com') && url.includes('/upload/') ? url.replace('/upload/', `/upload/w_${w},c_limit,q_85,f_jpg/`) : url;
}

export async function fetchImageFile(url: string, name: string): Promise<File | null> {
  if (!url) return null;
  try {
    const r = await fetch(jpgUrl(url));
    if (!r.ok) return null;
    const b = await r.blob();
    return new File([b], name.endsWith('.jpg') ? name : `${name}.jpg`, { type: b.type || 'image/jpeg' });
  } catch {
    return null;
  }
}

/** True on phones/tablets whose browser can hand files to WhatsApp via the share sheet. */
export function canShareFiles(): boolean {
  try {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.share &&
      !!navigator.canShare?.({ files: [new File([''], 'x.jpg', { type: 'image/jpeg' })] })
    );
  } catch {
    return false;
  }
}

/** Opens the share sheet with photo(s) + message. Returns 'shared' | 'cancelled' | 'failed'. */
export async function sharePhotosWithText(files: File[], text: string): Promise<'shared' | 'cancelled' | 'failed'> {
  try {
    if (!files.length || !navigator.canShare?.({ files, text })) return 'failed';
    await navigator.share({ files, text });
    return 'shared';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    return 'failed';
  }
}

/** Copies a photo to the clipboard as PNG (what WhatsApp Web accepts for Ctrl+V). */
export async function copyImageToClipboard(file: File | null): Promise<boolean> {
  if (!file || typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
  try {
    const png = new Promise<Blob>(async (resolve, reject) => {
      try {
        const bmp = await createImageBitmap(file);
        const c = document.createElement('canvas');
        c.width = bmp.width;
        c.height = bmp.height;
        c.getContext('2d')!.drawImage(bmp, 0, 0);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png');
      } catch (e) {
        reject(e);
      }
    });
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return true;
  } catch {
    return false;
  }
}

export function waChatUrl(phone: string, text: string): string {
  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
}
export function waTextUrl(text: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}
