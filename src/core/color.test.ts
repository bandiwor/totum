import { describe, expect, it } from 'vitest';
import { contrast, hex, oklch, onColor } from './color';

describe('color', () => {
  it('converts OKLCH to sRGB', () => {
    expect(hex(oklch(1, 0, 0))).toBe('#ffffff');
    expect(hex(oklch(0, 0, 0))).toBe('#000000');
    // Pure sRGB red is roughly oklch(0.628 0.258 29.2).
    expect(hex(oklch(0.628, 0.2577, 29.23))).toBe('#ff0000');
  });

  it('keeps out-of-gamut colours in gamut by lowering chroma', () => {
    const c = oklch(0.9, 0.4, 145);
    expect(c.every((x) => x >= 0 && x <= 1)).toBe(true);
  });

  it('every hue of the dark-theme accent stays readable on black', () => {
    for (let h = 0; h < 360; h += 15) expect(contrast(oklch(0.64, 0.24, h), [0, 0, 0])).toBeGreaterThan(5);
  });

  it('picks black text on yellow, white on blue', () => {
    expect(onColor(oklch(0.85, 0.17, 95))).toEqual([0, 0, 0]);
    expect(onColor(oklch(0.5, 0.2, 265))).toEqual([1, 1, 1]);
  });
});
