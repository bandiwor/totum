import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { haptic } from '@/core/haptics';
import { registry, type QuickAction, type QuickActionContext } from '@/core/registry';
import { path } from '@/core/router';
import { cx, Icon } from '@/ui';
import { t } from '@/core/i18n';

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

const EXIT_MS = 220;

export function QuickMenu() {
  const open = quickMenuOpen.value;
  const [mounted, setMounted] = useState(open);
  const [active, setActive] = useState<QuickAction | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => {
      setMounted(false);
      setActive(null);
    }, EXIT_MS);
    return () => clearTimeout(t);
  }, [open]);

  if (!mounted) return null;

  const ctx: QuickActionContext = {
    close: () => (quickMenuOpen.value = false),
    back: () => setActive(null),
  };
  const actions = registry.quickActions().sort((a, b) => (b.relevance?.() ?? 0) - (a.relevance?.() ?? 0) || a.order - b.order);

  const pick = (a: QuickAction): void => {
    haptic('light');
    if (a.run) a.run(ctx);
    else setActive(a);
  };

  return (
    <div class={cx('quick', open ? 'is-open' : 'is-exit')}>
      <div class="quick__backdrop" onClick={ctx.close} />
      <div class="quick__panel">
        {active?.screen ? (
          <div class="quick__screen" key={active.id}>
            <div class="quick__screen-head">
              <button type="button" class="quick__back" onClick={ctx.back} aria-label={t('common.back')}>
                <Icon name="chevronLeft" />
              </button>
              <h2>{t(active.label)}</h2>
            </div>
            <div class="quick__screen-body">
              <active.screen {...ctx} />
            </div>
          </div>
        ) : (
          <div class="quick__grid">
            {actions.map((a, i) => {
              const hint = a.hint?.();
              return (
                <button
                  key={a.id}
                  type="button"
                  class={cx('ui-tile', i === 0 && 'ui-tile--wide')}
                  style={{ '--i': i }}
                  onClick={() => pick(a)}
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
      <button type="button" class="quick__close" aria-label={t('common.close')} onClick={() => { haptic('light'); ctx.close(); }}>
        <Icon name="x" size={26} />
      </button>
    </div>
  );
}
