import * as ImageManipulator from 'expo-image-manipulator';
import { applyPixelFilter } from './pixelFilter';
import type { Picked } from './posts';

export type Aspect = 'original' | '1:1' | '4:5';
export type Edit = { rotate: 0 | 90 | 180 | 270; flipped: boolean; aspect: Aspect; filter: string };
export const defaultEdit: Edit = { rotate: 0, flipped: false, aspect: 'original', filter: 'normal' };

/** Everything but the filter, so filter previews can share one base render. */
export const baseKey = (e: Edit) => `${e.rotate}|${e.flipped}|${e.aspect}`;

const aspectRatio: Record<Exclude<Aspect, 'original'>, number> = { '1:1': 1, '4:5': 4 / 5 };

/** Largest centred crop of the given width/height that has the target ratio. */
export function centreCrop(width: number, height: number, ratio: number) {
  const current = width / height;
  const w = current > ratio ? Math.round(height * ratio) : width;
  const h = current > ratio ? height : Math.round(width / ratio);
  return { originX: Math.round((width - w) / 2), originY: Math.round((height - h) / 2), width: w, height: h };
}

/** Applies rotation, flip, crop and filter, and returns a JPEG no wider than maxWidth. */
export async function renderEdit(asset: Picked, edit: Edit, maxWidth: number): Promise<Picked> {
  const swap = edit.rotate === 90 || edit.rotate === 270;
  const w = swap ? asset.height : asset.width;
  const h = swap ? asset.width : asset.height;
  const actions: ImageManipulator.Action[] = [];
  if (edit.rotate) actions.push({ rotate: edit.rotate });
  if (edit.flipped) actions.push({ flip: ImageManipulator.FlipType.Horizontal });
  let outW = w;
  if (edit.aspect !== 'original') {
    const crop = centreCrop(w, h, aspectRatio[edit.aspect]);
    actions.push({ crop });
    outW = crop.width;
  }
  if (outW > maxWidth) actions.push({ resize: { width: maxWidth } });
  const out = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return applyPixelFilter({ uri: out.uri, width: out.width, height: out.height }, edit.filter);
}
