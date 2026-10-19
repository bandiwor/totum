import { useEffect } from 'preact/hooks';
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
  return (
    <nav class="tabbar">
      {registry.tabs().map((tab) => (
        <button
          key={tab.path}
          type="button"
          class={cx('ui-tab', active === tab.path && 'is-active')}
          onClick={() => {
            if (active === tab.path && path.value === tab.path) return;
            haptic('selection');
            navigate(tab.path);
          }}
        >
          <Icon name={tab.icon} size={24} />
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

  useEffect(() => {
    if (!match) navigate(defaultTab, { replace: true });
  }, [match, defaultTab]);

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
