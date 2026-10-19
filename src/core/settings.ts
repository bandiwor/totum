import { defineDoc } from './store/store';
import type { Minutes } from './date';

export type ThemePref = 'dark' | 'light' | 'system';

export interface AppSettings {
  theme: ThemePref;
  /** OKLCH hue of the accent colour (lightness/chroma are fixed per theme). */
  accentHue: number;
  haptics: boolean;
  /** Decorative effects (celebrations, particles). Hooks exist in core/fx.ts. */
  effects: boolean;
  /** Awake window used for free-time calculation. */
  dayStart: Minutes;
  dayEnd: Minutes;
  /** Go home between commitments only if the stay is at least this long. */
  minHomeStay: Minutes;
}

export const settings = defineDoc<AppSettings>('settings', {
  theme: 'dark',
  accentHue: 25,
  haptics: true,
  effects: true,
  dayStart: 7 * 60 + 30,
  dayEnd: 23 * 60 + 30,
  minHomeStay: 40,
});
