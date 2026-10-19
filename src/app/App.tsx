import { useEffect, useRef, useState } from 'preact/hooks';
import { haptic } from '@/core/haptics';
import { applyUpdate, updateReady } from '@/core/pwa';
import { registry } from '@/core/registry';
import { currentTab, direction, matchRoute, navigate, path } from '@/core/router';
import { openQuickMenu, QuickMenu } from '@/features/quick/QuickMenu';
import { FxLayer } from '@/ui/FxLayer';
import { ScreenStack } from './ScreenStack';
import { useSlideSelect } from '@/ui/slideSelect';
import { cx, Icon, OverlayHost } from '@/ui';
import { t } from '@/core/i18n';

const TAB_INSET = 14;

function TabBar() {
  const active = currentTab.value;
  const tabs = registry.tabs();
  const index = Math.max(0, tabs.findIndex((tab) => tab.path === active));
  const go = (i: number): void => {
    const tab = tabs[i];
    if (!tab || (active === tab.path && path.value === tab.path)) return;
    haptic('selection');
    navigate(tab.path);
  };
  const slide = useSlideSelect(tabs.length, index, go, TAB_INSET);

  // Re-key the blob on every change so its squash animation replays.
  const prev = useRef(slide.shown);
  const [moving, setMoving] = useState(0);
  useEffect(() => {
    if (prev.current === slide.shown) return;
    prev.current = slide.shown;
    setMoving((n) => n + 1);
  }, [slide.shown]);

  return (
    <nav
      class={cx('tabbar', slide.pressed && 'is-pressed', slide.thumbX !== null && 'is-dragging')}
      style={{ '--n': tabs.length, '--i': index, '--tab-pad-x': `${TAB_INSET}px` }}
      {...slide.handlers}
    >
      {tabs.some((tab) => tab.path === active) && (
        <span class="tabbar__indicator" style={slide.thumbX === null ? undefined : { transform: `translateX(${slide.thumbX}px)` }}>
          <span key={moving} class={cx('tabbar__blob', moving > 0 && slide.thumbX === null && 'is-moving')} />
        </span>
      )}
      {tabs.map((tab, i) => (
        <button
          key={tab.path}
          type="button"
          class={cx('ui-tab', i === slide.shown && tabs.some((x) => x.path === active) && 'is-active', i === slide.shown && !slide.centered && 'is-passing')}
          aria-current={active === tab.path ? 'page' : undefined}
          onClick={() => go(i)}
        >
          <span class="ui-tab__icon">
            <Icon name={tab.icon} size={22} />
          </span>
          <span>{t(tab.label)}</span>
        </button>
      ))}
    </nav>
  );
}

function UpdateBanner() {
  if (!updateReady.value) return null;
  return (
    <div class="update-banner">
      <span>{t('app.updateAvailable')}</span>
      <button type="button" onClick={() => { haptic('medium'); applyUpdate(); }}>
        {t('app.update')}
      </button>
    </div>
  );
}

export function App() {
  const routes = registry.routes();
  const current = path.value;
  const defaultTab = registry.tabs()[0]?.path ?? '';

  let match: { component: (typeof routes)[number]['component']; params: Record<string, string> } | null = null;
  for (const r of routes) {
    const params = matchRoute(r.pattern, current);
    if (params) {
      match = { component: r.component, params };
      break;
    }
  }

  // Unknown routes and sections of turned-off modules fall back to the first tab.
  const tabHidden = registry.allTabs().some((tab) => tab.path === currentTab.value) && !registry.tabs().some((tab) => tab.path === currentTab.value);
  useEffect(() => {
    if (!match || tabHidden) navigate(defaultTab, { replace: true });
  }, [match, tabHidden, defaultTab]);

  const Screen = match?.component;
  return (
    <div class="app">
      <main class="app__stage">
        {Screen && match && <ScreenStack current={current} Screen={Screen} params={match.params} dir={direction.value} />}
      </main>
      <UpdateBanner />
      <button type="button" class="ui-fab" aria-label={t('app.quickActions')} onClick={openQuickMenu}>
        <Icon name="plus" size={28} />
      </button>
      <TabBar />
      <QuickMenu />
      <OverlayHost />
      <FxLayer />
    </div>
  );
}
