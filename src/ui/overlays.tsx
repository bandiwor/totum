import { signal } from '@preact/signals';
import type { ComponentChild, ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { haptic } from '@/core/haptics';
import { Button, cx, Icon } from './primitives';
import { t } from '@/core/i18n';

/**
 * Imperative overlays rendered by <OverlayHost/> at the app root, so they are
 * never trapped inside transformed (animating) pages.
 */
interface OverlayEntry {
  id: number;
  kind: 'sheet' | 'dialog' | 'fullscreen';
  title?: string;
  render: (close: () => void) => ComponentChild;
  onClose?: () => void;
  closing: boolean;
}

const overlays = signal<readonly OverlayEntry[]>([]);
let seq = 0;

const EXIT_MS = 260;

function closeOverlay(id: number): void {
  const entry = overlays.value.find((o) => o.id === id);
  if (!entry || entry.closing) return;
  overlays.value = overlays.value.map((o) => (o.id === id ? { ...o, closing: true } : o));
  setTimeout(() => {
    overlays.value = overlays.value.filter((o) => o.id !== id);
    entry.onClose?.();
  }, EXIT_MS);
}

export interface OverlayHandle {
  close: () => void;
}

export function openSheet(
  render: (close: () => void) => ComponentChild,
  opts: { title?: string; onClose?: () => void; fullscreen?: boolean } = {},
): OverlayHandle {
  const id = ++seq;
  const entry: OverlayEntry = { id, kind: opts.fullscreen ? 'fullscreen' : 'sheet', render, closing: false };
  if (opts.title) entry.title = opts.title;
  if (opts.onClose) entry.onClose = opts.onClose;
  overlays.value = [...overlays.value, entry];
  return { close: () => closeOverlay(id) };
}

export function confirm(opts: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let answered = false;
    const id = ++seq;
    const answer = (ok: boolean): void => {
      if (answered) return;
      answered = true;
      resolve(ok);
      closeOverlay(id);
    };
    overlays.value = [
      ...overlays.value,
      {
        id,
        kind: 'dialog',
        closing: false,
        onClose: () => answer(false),
        render: () => (
          <div class="ui-dialog">
            <p class="ui-dialog__title">{opts.title}</p>
            {opts.message && <p class="ui-dialog__message">{opts.message}</p>}
            <div class="ui-dialog__actions">
              <Button variant="secondary" onClick={() => answer(false)}>
                {opts.cancelLabel ?? t('common.cancel')}
              </Button>
              <Button variant={opts.danger ? 'danger' : 'primary'} feedback={opts.danger ? 'warning' : 'light'} onClick={() => answer(true)}>
                {opts.confirmLabel ?? t('common.ok')}
              </Button>
            </div>
          </div>
        ),
      },
    ];
    if (opts.danger) haptic('warning');
  });
}

// ── Toasts ──────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  text: string;
  tone: 'neutral' | 'success' | 'error';
  action?: { label: string; run: () => void };
}

const toasts = signal<readonly Toast[]>([]);

export function toast(text: string, opts: { tone?: Toast['tone']; action?: Toast['action'] } = {}): void {
  const t: Toast = { id: ++seq, text, tone: opts.tone ?? 'neutral' };
  if (opts.action) t.action = opts.action;
  toasts.value = [...toasts.value.slice(-2), t];
  if (t.tone === 'error') haptic('error');
  setTimeout(() => (toasts.value = toasts.value.filter((x) => x.id !== t.id)), opts.action ? 4500 : 2600);
}

// ── Host ────────────────────────────────────────────────────────────────────

function SheetFrame({ entry }: { entry: OverlayEntry }) {
  const [entered, setEntered] = useState(false);
  const [drag, setDrag] = useState(0);
  const start = useRef<{ y: number; t: number } | null>(null);
  const close = (): void => closeOverlay(entry.id);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const state = entry.closing ? 'is-exit' : entered ? 'is-open' : '';
  const dragHandlers = {
    onPointerDown: (e: PointerEvent) => {
      // Let buttons in the header (close) receive their click.
      if ((e.target as Element).closest('button')) return;
      start.current = { y: e.clientY, t: performance.now() };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent) => {
      if (start.current) setDrag(Math.max(0, e.clientY - start.current.y));
    },
    onPointerUp: (e: PointerEvent) => {
      if (!start.current) return;
      const dy = e.clientY - start.current.y;
      const velocity = dy / Math.max(1, performance.now() - start.current.t);
      start.current = null;
      setDrag(0);
      if (dy > 120 || velocity > 0.6) {
        haptic('light');
        close();
      }
    },
  };

  return (
    <div class={cx('ui-overlay', `ui-overlay--${entry.kind}`, state)}>
      <div class="ui-overlay__backdrop" onClick={entry.kind === 'fullscreen' ? undefined : close} />
      {entry.kind === 'dialog' ? (
        entry.render(close)
      ) : (
        <div class="ui-sheet" style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}>
          <div class="ui-sheet__grabber" {...dragHandlers}>
            <span />
          </div>
          {entry.title && (
            <div class="ui-sheet__head" {...dragHandlers}>
              <h2>{entry.title}</h2>
              <button type="button" class="ui-sheet__close" aria-label={t('common.close')} onClick={close}>
                <Icon name="x" size={18} />
              </button>
            </div>
          )}
          <div class="ui-sheet__body">{entry.render(close)}</div>
        </div>
      )}
    </div>
  );
}

export function OverlayHost() {
  return (
    <>
      {overlays.value.map((o) => (
        <SheetFrame key={o.id} entry={o} />
      ))}
      <div class="ui-toasts" aria-live="polite">
        {toasts.value.map((t) => (
          <div key={t.id} class={cx('ui-toast', `ui-toast--${t.tone}`)}>
            <span>{t.text}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.run();
                  toasts.value = toasts.value.filter((x) => x.id !== t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

export function SheetActions({ children }: { children: ComponentChildren }) {
  return <div class="ui-sheet__actions">{children}</div>;
}
