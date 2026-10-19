/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';
import pkg from './package.json' with { type: 'json' };
import { serviceWorker } from './build/sw-plugin';

const buildId = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const appVersion = `${pkg.version}+${buildId}`;

export default defineConfig({
  // Relative base: the app works from any GitHub Pages sub-path (e.g. /organizer/).
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [preact(), serviceWorker({ entry: 'src/sw/sw.ts', version: appVersion })],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
