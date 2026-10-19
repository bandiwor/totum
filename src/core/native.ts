/**
 * Makes the web view behave like a native app: no pinch / double-tap zoom,
 * no long-press callouts outside editable text. Text selection is disabled in
 * CSS (see ui/base.css) and re-enabled for inputs and `[data-selectable]`.
 */
function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, [contenteditable], [data-selectable]') !== null)
  );
}

export function installNativeFeel(): void {
  const prevent = (e: Event): void => e.preventDefault();
  // Safari-only pinch gesture events.
  document.addEventListener('gesturestart', prevent, { passive: false });
  document.addEventListener('gesturechange', prevent, { passive: false });
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false },
  );
  document.addEventListener('contextmenu', (e) => {
    if (!isEditable(e.target)) e.preventDefault();
  });
  document.addEventListener('dblclick', prevent, { passive: false });

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  document.documentElement.dataset.standalone = String(standalone);
  if (standalone) fitStandaloneHeight();
}

/**
 * iOS home-screen apps with a translucent status bar report a layout viewport
 * shorter than the screen by the top inset, so `inset: 0` stops ~59pt above
 * the bottom edge. Size the app from the physical screen instead (never smaller
 * than what the browser reports).
 */
function fitStandaloneHeight(): void {
  const root = document.documentElement;
  const apply = (): void => {
    const portrait = window.innerHeight >= window.innerWidth;
    const screenH = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
    const h = Math.max(screenH, window.innerHeight);
    if (h > window.innerHeight) root.style.setProperty('--app-h', `${h}px`);
    else root.style.removeProperty('--app-h');
  };
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => setTimeout(apply, 300));
}
