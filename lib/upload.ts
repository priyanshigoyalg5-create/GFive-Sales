const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'jhddliu0';
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'textile_preset';

/** Shrinks big phone photos (often 4–8 MB) to max 2000px JPEG before upload. */
async function downscale(file: File, maxSide = 2000, quality = 0.88): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export async function uploadImage(file: File): Promise<string> {
  const body = new FormData();
  body.append('file', await downscale(file));
  body.append('upload_preset', UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body });
  const data = await res.json();
  if (!res.ok || !data.secure_url) {
    throw new Error(data?.error?.message || 'Photo upload failed. Please try again.');
  }
  return data.secure_url as string;
}
