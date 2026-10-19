import { computed, signal } from '@preact/signals';

/**
 * Hash router (GitHub Pages has no SPA fallback). Paths look like
 * "#/health/workouts/abc". Navigation direction drives page transitions.
 */
export type NavDirection = 'push' | 'pop' | 'tab' | 'none';

function readPath(): string {
  const raw = location.hash.replace(/^#\/?/, '');
  return raw.split('?')[0]?.replace(/\/+$/, '') ?? '';
}

export const path = signal(readPath());
export const direction = signal<NavDirection>('none');
export const segments = computed(() => path.value.split('/').filter(Boolean));
export const currentTab = computed(() => segments.value[0] ?? '');

function setPath(next: string): void {
  const prev = segments.value;
  const nextSegs = next.split('/').filter(Boolean);
  direction.value =
    prev[0] !== nextSegs[0] ? 'tab' : nextSegs.length > prev.length ? 'push' : nextSegs.length < prev.length ? 'pop' : 'none';
  path.value = nextSegs.join('/');
}

window.addEventListener('hashchange', () => setPath(readPath()));

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  const clean = to.replace(/^#?\/?/, '');
  if (clean === path.value) return;
  const url = `#/${clean}`;
  if (opts.replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  setPath(clean);
}

/** Back within the app; falls back to the parent path when there's no history. */
export function goBack(): void {
  const parent = segments.value.slice(0, -1).join('/');
  if (history.length > 1 && history.state !== 'root') history.back();
  else navigate(parent, { replace: true });
}

export function markRoot(): void {
  history.replaceState('root', '', location.href);
}

/** Matches "health/workouts/:id" against a path. */
export function matchRoute(pattern: string, target: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const t = target.split('/').filter(Boolean);
  if (p.length !== t.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    const ps = p[i] as string;
    const ts = t[i] as string;
    if (ps.startsWith(':')) params[ps.slice(1)] = decodeURIComponent(ts);
    else if (ps !== ts) return null;
  }
  return params;
}
