import { applyFilterToPixels, filterById } from './filters';
import type { Picked } from './posts';

export const filtersSupported = true;

function load(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that photo.'));
    img.src = uri;
  });
}

/** Draws the photo to a canvas, adjusts the pixels, and returns a new JPEG object URL. */
export async function applyPixelFilter(asset: Picked, filterId: string): Promise<Picked> {
  if (filterId === 'normal') return asset;
  const img = await load(asset.uri);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return asset;
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyFilterToPixels(pixels.data, filterById(filterId));
  ctx.putImageData(pixels, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!blob) return asset;
  return { uri: URL.createObjectURL(blob), width: canvas.width, height: canvas.height };
}
