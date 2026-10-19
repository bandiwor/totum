import { effect } from '@preact/signals';
import { settings } from '@/core/settings';

const dark = window.matchMedia('(prefers-color-scheme: dark)');

function apply(): void {
  const pref = settings.value.value.theme;
  const theme = pref === 'system' ? (dark.matches ? 'dark' : 'light') : pref;
  document.documentElement.dataset.theme = theme;
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}

export function installTheme(): void {
  effect(apply);
  dark.addEventListener('change', apply);
}
