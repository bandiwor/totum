import { transformWithEsbuild, type Plugin } from 'vite';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

interface Options {
  /** Service worker source (TypeScript, no imports). */
  entry: string;
  /** Build version; a new value makes the browser see a new SW and offer an update. */
  version: string;
}

async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (d: string): Promise<void> => {
    for (const e of await readdir(d, { withFileTypes: true }).catch(() => [])) {
      const p = join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else out.push(relative(dir, p).split('\\').join('/'));
    }
  };
  await walk(dir);
  return out;
}

/**
 * Emits `sw.js` with the full precache list (bundle + public files) injected.
 * Zero runtime dependencies, full control over the update flow.
 */
export function serviceWorker(opts: Options): Plugin {
  let root = '';
  let publicDir = '';
  return {
    name: 'organizer-sw',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      publicDir = config.publicDir;
    },
    async generateBundle(_options, bundle) {
      // index.html is emitted by Vite's HTML plugin after this hook runs, so add it explicitly.
      const files = new Set(['index.html', ...Object.keys(bundle)]);
      if (publicDir) for (const f of await listFiles(publicDir)) files.add(f);
      const precache = [...files]
        .filter((f) => f !== 'sw.js' && !f.endsWith('.map') && !f.startsWith('.'))
        .map((f) => `./${f}`);

      const entry = resolve(root, opts.entry);
      const source = await readFile(entry, 'utf8');
      const { code } = await transformWithEsbuild(source, entry, {
        loader: 'ts',
        format: 'iife',
        target: 'es2020',
        minify: true,
      });
      const header =
        `const __PRECACHE__=${JSON.stringify(precache)};` +
        `const __VERSION__=${JSON.stringify(opts.version)};\n`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: header + code });
    },
  };
}
