import type { Picked } from './posts';

/** Native builds do not bake filters yet (needs a GPU image library); crop, rotate and flip still work. */
export const filtersSupported = false;

export async function applyPixelFilter(asset: Picked, _filterId: string): Promise<Picked> {
  return asset;
}
