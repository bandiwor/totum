/**
 * Colour engine. Palettes are generated in OKLCH (perceptually uniform), so any
 * hue at a fixed lightness/chroma looks equally clean and equally contrasted —
 * that's what makes a free accent choice safe. Output is plain sRGB hex.
 */

export type RGB = [number, number, number];

function oklchToLinear(L: number, C: number, H: number): RGB {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (c: RGB): boolean => c.every((x) => x >= -1e-4 && x <= 1 + 1e-4);

const encode = (x: number): number => {
  const v = Math.min(1, Math.max(0, x));
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
};

/** OKLCH → sRGB, reducing chroma (not clipping) until the colour fits the gamut. */
export function oklch(L: number, C: number, H: number): RGB {
  let c = C;
  let lin = oklchToLinear(L, c, H);
  if (!inGamut(lin)) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 20; i++) {
      c = (lo + hi) / 2;
      if (inGamut(oklchToLinear(L, c, H))) lo = c;
      else hi = c;
    }
    lin = oklchToLinear(L, lo, H);
  }
  return lin.map(encode) as RGB;
}

export function hex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`;
}

export function rgba([r, g, b]: RGB, alpha: number): string {
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
}

function luminance(c: RGB): number {
  const lin = c.map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)) as RGB;
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function contrast(a: RGB, b: RGB): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

const WHITE: RGB = [1, 1, 1];
const BLACK: RGB = [0, 0, 0];

/** White or black — whichever reads better on the colour. */
export function onColor(c: RGB): RGB {
  return contrast(c, WHITE) >= Math.min(4.5, contrast(c, BLACK)) ? WHITE : BLACK;
}
