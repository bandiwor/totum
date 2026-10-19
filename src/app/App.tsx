import { useEffect, useRef, useState } from 'preact/hooks';
import { haptic } from '@/core/haptics';
import { applyUpdate, updateReady } from '@/core/pwa';
import { registry } from '@/core/registry';
import { currentTab, direction, matchRoute, navigate, path } from '@/core/router';
import { openQuickMenu, QuickMenu } from '@/features/quick/QuickMenu';
import { FxLayer } from '@/ui/FxLayer';
import { ScreenStack } from './ScreenStack';
import { cx, Icon, OverlayHost } from '@/ui';
import { t } from '@/core/i18n';

function TabBar() {
  const active = currentTab.value;
  const tabs = registry.tabs();
  const index = Math.max(0, tabs.findIndex((tab) => tab.path === active));
  const prev = useRef(index);
  const [moving, setMoving] = useState(0);
  useEffect(() => {
    if (prev.current === index) return;
    prev.current = index;
    setMoving((n) => n + 1);
  }, [index]);

  return (
    <nav class="tabbar" style={{ '--n': tabs.length, '--i': index }}>
      {tabs.some((tab) => tab.path === active) && (
        <span class="tabbar__indicator">
          <span key={moving} class={cx('tabbar__blob', moving > 0 && 'is-moving')} />
        </span>
      )}
      {tabs.map((tab) => (
        <button
          key={tab.path}
          type="button"
          class={cx('ui-tab', active === tab.path && 'is-active')}
          aria-current={active === tab.path ? 'page' : undefined}
          onClick={() => {
            if (active === tab.path && path.value === tab.path) return;
            haptic('selection');
            navigate(tab.path);
          }}
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
