import { effect } from '@preact/signals';
import { hex, oklch, onColor, rgba, type RGB } from '@/core/color';
import { settings } from '@/core/settings';

type Mode = 'dark' | 'light';

/** Fixed lightness/chroma per theme: any hue is clean and readable on that background. */
const TONES: Record<Mode, { accent: [number, number]; status: [number, number]; category: [number, number]; bg: string }> = {
  dark: { accent: [0.64, 0.24], status: [0.76, 0.17], category: [0.74, 0.14], bg: '#000000' },
  light: { accent: [0.56, 0.22], status: [0.56, 0.16], category: [0.6, 0.15], bg: '#f2f2f7' },
};

/** Categorical hues for subjects, lesson types, categories (c1…c8). */
const CATEGORY_HUES = [275, 150, 75, 10, 230, 310, 45, null] as const;

export const ACCENT_PRESETS = [25, 50, 80, 150, 190, 245, 285, 330] as const;

export function accentColor(hue: number, mode: Mode): RGB {
  const [L, C] = TONES[mode].accent;
  return oklch(L, C, hue);
}

function palette(mode: Mode, hue: number): Record<string, string> {
  const t = TONES[mode];
  const accent = accentColor(hue, mode);
  const success = oklch(t.status[0], t.status[1], 150);
  const warning = oklch(mode === 'dark' ? 0.82 : 0.62, t.status[1], 70);
  const danger = oklch(t.accent[0], t.accent[1], 22);
  const vars: Record<string, string> = {
    '--accent': hex(accent),
    '--accent-soft': rgba(accent, mode === 'dark' ? 0.18 : 0.12),
    '--accent-contrast': hex(onColor(accent)),
    '--accent-2': hex(success),
    '--accent-2-soft': rgba(success, mode === 'dark' ? 0.16 : 0.12),
    '--warning': hex(warning),
    '--warning-soft': rgba(warning, 0.16),
    '--danger': hex(danger),
    '--danger-soft': rgba(danger, mode === 'dark' ? 0.18 : 0.1),
  };
  CATEGORY_HUES.forEach((h, i) => {
    const [L, C] = t.category;
    vars[`--c-${i + 1}`] = hex(h === null ? oklch(L, 0.02, 260) : oklch(L, C, h));
  });
  vars['--on-category'] = hex(onColor(oklch(t.category[0], t.category[1], 230)));
  return vars;
}

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function apply(): void {
  const s = settings.value.value;
  const mode: Mode = s.theme === 'system' ? (darkQuery.matches ? 'dark' : 'light') : s.theme;
  const root = document.documentElement;
  root.dataset.theme = mode;
  for (const [k, v] of Object.entries(palette(mode, s.accentHue))) root.style.setProperty(k, v);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', TONES[mode].bg);
}

export function installTheme(): void {
  effect(apply);
  darkQuery.addEventListener('change', apply);
}
