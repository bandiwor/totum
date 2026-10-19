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
  /** Arrive this many minutes early wherever you need to travel. */
  arriveEarly: Minutes;
  /** Turned-off modules (see core/modules.ts). */
  disabledModules: string[];
  /** Tab paths in the user's order. Empty = default order. */
  tabOrder: string[];
  /** UI language: a built-in id (ru, en) or the id of a custom language. */
  language: string;
  /** The welcome screen was completed. */
  onboarded: boolean;
}

export const settings = defineDoc<AppSettings>('settings', {
  theme: 'dark',
  accentHue: 25,
  haptics: true,
  effects: true,
  dayStart: 7 * 60 + 30,
  dayEnd: 23 * 60 + 30,
  minHomeStay: 40,
  arriveEarly: 5,
  disabledModules: [],
  tabOrder: [],
  language: 'ru',
  onboarded: false,
});
