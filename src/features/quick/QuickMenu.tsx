import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { haptic } from '@/core/haptics';
import { t } from '@/core/i18n';
import { registry, type QuickAction, type QuickActionContext } from '@/core/registry';
import { path } from '@/core/router';
import { cx, Icon } from '@/ui';

/** The "super button" menu: a few huge tiles, two taps to anything. */
export const quickMenuOpen = signal(false);

// Any navigation (e.g. "start workout" from inside the menu) closes the menu.
path.subscribe(() => {
  quickMenuOpen.value = false;
});

export function openQuickMenu(): void {
  haptic('medium');
  quickMenuOpen.value = true;
}

/** Durations match the CSS below (quick-* animations). */
const MENU_EXIT_MS = 220;
const SWAP_MS = 150;

type View = { kind: 'grid' } | { kind: 'screen'; action: QuickAction };

export function QuickMenu() {
  const open = quickMenuOpen.value;
  const [mounted, setMounted] = useState(open);
  const [view, setView] = useState<View>({ kind: 'grid' });
  const [leaving, setLeaving] = useState(false);
  /** Where the tapped tile was, so the sub-screen grows out of it. */
  const [origin, setOrigin] = useState('50% 50%');
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => {
      setMounted(false);
      setView({ kind: 'grid' });
      setLeaving(false);
    }, MENU_EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);

  if (!mounted) return null;

  const swap = (next: View): void => {
    setLeaving(true);
    setTimeout(() => {
      setView(next);
      setLeaving(false);
    }, SWAP_MS);
  };

  const ctx: QuickActionContext = {
    close: () => (quickMenuOpen.value = false),
    back: () => {
      haptic('light');
      swap({ kind: 'grid' });
    },
  };
  const actions = registry.quickActions().sort((a, b) => (b.relevance?.() ?? 0) - (a.relevance?.() ?? 0) || a.order - b.order);

  const pick = (a: QuickAction, tile: HTMLElement): void => {
    haptic('light');
    if (a.run) {
      a.run(ctx);
      return;
    }
    const p = panel.current?.getBoundingClientRect();
    const r = tile.getBoundingClientRect();
    if (p) setOrigin(`${r.left + r.width / 2 - p.left}px ${r.top + r.height / 2 - p.top}px`);
    swap({ kind: 'screen', action: a });
  };

  return (
    <div class={cx('quick', open ? 'is-open' : 'is-exit')}>
      <div class="quick__backdrop" onClick={ctx.close} />
      <div class="quick__panel" ref={panel}>
        {view.kind === 'screen' && view.action.screen ? (
          <div class={cx('quick__screen', leaving && 'is-leaving')} key={view.action.id} style={{ transformOrigin: origin }}>
            <div class="quick__screen-head">
              <button type="button" class="quick__back" onClick={ctx.back} aria-label={t('common.back')}>
                <Icon name="chevronLeft" />
              </button>
              <h2>{t(view.action.label)}</h2>
            </div>
            <div class="quick__screen-body">
              <view.action.screen {...ctx} />
            </div>
          </div>
        ) : (
          <div class={cx('quick__grid', leaving && 'is-leaving')}>
            {actions.map((a, i) => {
              const hint = a.hint?.();
              return (
                <button
                  key={a.id}
                  type="button"
                  class={cx('ui-tile', i === 0 && 'ui-tile--wide')}
                  style={{ '--i': i }}
                  onClick={(e) => pick(a, e.currentTarget)}
                >
                  <span class="ui-tile__icon">
                    <Icon name={a.icon} size={26} />
                  </span>
                  <span class="ui-tile__label">{t(a.label)}</span>
                  {hint && <span class="ui-tile__hint">{hint}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <button
        type="button"
        class="quick__close"
        aria-label={t('common.close')}
        onClick={() => {
          haptic('light');
          ctx.close();
        }}
      >
        <Icon name="x" size={26} />
      </button>
    </div>
  );
}
