import { render } from 'preact';
import './ui/tokens.css';
import './ui/base.css';
import './ui/components.css';
import './app/app.css';
import { FEATURES } from './app/features';
import { App } from './app/App';
import { installTheme } from './app/theme';
import { installNativeFeel } from './core/native';
import { registerServiceWorker, requestPersistentStorage } from './core/pwa';
import { registerFeatures, runReadyHooks } from './core/registry';
import { markRoot } from './core/router';
import { loadAll } from './core/store/store';
import { t } from './core/i18n';

async function boot(): Promise<void> {
  installNativeFeel();
  registerFeatures(FEATURES);
  await loadAll();
  runReadyHooks();
  installTheme();
  markRoot();
  const root = document.getElementById('app');
  if (!root) throw new Error('#app not found');
  render(<App />, root);
  document.getElementById('splash')?.remove();
  void registerServiceWorker();
  void requestPersistentStorage();
}

boot().catch((e: unknown) => {
  console.error(e);
  const root = document.getElementById('app');
  if (root) root.textContent = t('app.bootError', { message: e instanceof Error ? e.message : String(e) });
});
