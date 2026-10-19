// Renders PNG icons from public/icons/icon.svg with headless Chromium.
// Usage: node scripts/render-icons.mjs  (needs a Chromium binary in CHROMIUM or PATH)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chromium = process.env.CHROMIUM ?? 'chromium';
const svg = readFileSync('public/icons/icon.svg', 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'icons-'));

const targets = [
  { file: 'icon-192.png', size: 192, pad: 0, bg: 'transparent' },
  { file: 'icon-512.png', size: 512, pad: 0, bg: 'transparent' },
  // Maskable/Apple: full-bleed background, glyph inside the safe zone.
  { file: 'icon-maskable-512.png', size: 512, pad: 0.1, bg: '#000000' },
  { file: 'apple-touch-icon.png', size: 180, pad: 0, bg: '#000000' },
];

for (const t of targets) {
  const inner = Math.round(t.size * (1 - t.pad * 2));
  const html = `<html><body style="margin:0;background:${t.bg};width:${t.size}px;height:${t.size}px;display:grid;place-items:center">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`;
  const page = join(dir, `${t.file}.html`);
  writeFileSync(page, html);
  execFileSync(chromium, [
    '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
    `--window-size=${t.size},${t.size}`, `--screenshot=${join(process.cwd(), 'public/icons', t.file)}`, `file://${page}`,
  ], { stdio: 'ignore' });
  console.log('✓', t.file);
}
