import { put } from '@vercel/blob';

/**
 * Copies a remote asset into Vercel Blob so the app owns its URLs.
 * Without BLOB_READ_WRITE_TOKEN, the original URL is returned unchanged.
 */
export async function persistAsset(url: string, key: string): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return url;
  const res = await fetch(url);
  if (!res.ok) return url;
  const bytes = await res.arrayBuffer();
  const blob = await put(`basix/${key}`, new Blob([bytes], { type: res.headers.get('content-type') ?? 'image/png' }), {
    access: 'public',
    addRandomSuffix: true,
  });
  return blob.url;
}

/** Uploads a generated buffer (crop, cutout) and returns its URL; a data URL without Blob. */
export async function putAsset(buffer: Buffer, key: string, contentType = 'image/png'): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  }
  const blob = await put(`basix/${key}`, new Blob([new Uint8Array(buffer)], { type: contentType }), {
    access: 'public',
    addRandomSuffix: true,
  });
  return blob.url;
}
