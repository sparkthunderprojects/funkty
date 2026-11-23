/** Original colour looks. Each is a small set of adjustments applied per pixel before upload. */
export type Filter = {
  id: string;
  name: string;
  brightness: number; // 1 = unchanged
  contrast: number; // 1 = unchanged
  saturation: number; // 1 = unchanged, 0 = grey
  sepia: number; // 0..1
  tint: [number, number, number, number]; // r, g, b, strength 0..1
};

const base = { brightness: 1, contrast: 1, saturation: 1, sepia: 0, tint: [0, 0, 0, 0] as Filter['tint'] };

export const filters: Filter[] = [
  { id: 'normal', name: 'Normal', ...base },
  { id: 'vivid', name: 'Vivid', ...base, contrast: 1.12, saturation: 1.45 },
  { id: 'sunny', name: 'Sunny', ...base, brightness: 1.06, saturation: 1.2, tint: [255, 190, 90, 0.16] },
  { id: 'dusk', name: 'Dusk', ...base, contrast: 1.08, saturation: 1.1, tint: [255, 110, 150, 0.16] },
  { id: 'cool', name: 'Cool', ...base, saturation: 1.05, tint: [70, 140, 255, 0.18] },
  { id: 'fade', name: 'Fade', ...base, brightness: 1.08, contrast: 0.82, saturation: 0.8, tint: [255, 245, 235, 0.1] },
  { id: 'film', name: 'Film', ...base, contrast: 1.15, saturation: 0.85, sepia: 0.25, tint: [40, 70, 60, 0.08] },
  { id: 'mono', name: 'Mono', ...base, contrast: 1.05, saturation: 0 },
  { id: 'noir', name: 'Noir', ...base, brightness: 0.95, contrast: 1.35, saturation: 0 },
];

export const filterById = (id: string): Filter => filters.find((f) => f.id === id) ?? filters[0]!;

/** Applies a filter to RGBA bytes in place. Pure, so it is testable without a canvas. */
export function applyFilterToPixels(data: Uint8ClampedArray, f: Filter): void {
  const [tr, tg, tb, ta] = f.tint;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]!;
    let g = data[i + 1]!;
    let b = data[i + 2]!;
    if (f.sepia > 0) {
      const sr = 0.393 * r + 0.769 * g + 0.189 * b;
      const sg = 0.349 * r + 0.686 * g + 0.168 * b;
      const sb = 0.272 * r + 0.534 * g + 0.131 * b;
      r += (sr - r) * f.sepia;
      g += (sg - g) * f.sepia;
      b += (sb - b) * f.sepia;
    }
    if (f.saturation !== 1) {
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = l + (r - l) * f.saturation;
      g = l + (g - l) * f.saturation;
      b = l + (b - l) * f.saturation;
    }
    if (f.contrast !== 1) {
      r = (r - 128) * f.contrast + 128;
      g = (g - 128) * f.contrast + 128;
      b = (b - 128) * f.contrast + 128;
    }
    if (f.brightness !== 1) {
      r *= f.brightness;
      g *= f.brightness;
      b *= f.brightness;
    }
    if (ta > 0) {
      r += (tr - r) * ta;
      g += (tg - g) * ta;
      b += (tb - b) * ta;
    }
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}
