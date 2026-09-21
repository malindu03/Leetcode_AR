// Builds the extension into dist/, which is the folder Chrome loads.
//
// There is deliberately no Chrome-extension Vite plugin here. Those plugins
// turn content scripts into small loaders that `await import()` the real code,
// and that delay lets LeetCode grab window.fetch before our patch is in place.
// Nothing errors when that happens; detection just silently sees nothing.

import { rm, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Absolute paths, so nothing depends on which folder the script is run from
// or on what Vite considers its root for a given build.
const projectRoot = resolve(import.meta.dirname, '..');
const src = resolve(projectRoot, 'src');
const dist = resolve(projectRoot, 'dist');

// Every build writes into the same dist/, so it is cleared once here and each
// build is told not to clear it — otherwise each would delete the last one's output.
await rm(dist, { recursive: true, force: true });

// Content scripts and the worker get fixed output names because manifest.json
// is hand-written and names them directly.
async function buildScript(entry, outFile, format) {
  await build({
    configFile: false,
    logLevel: 'warn',
    build: {
      outDir: dist,
      emptyOutDir: false,
      rolldownOptions: {
        input: resolve(src, entry),
        output: { format, entryFileNames: outFile },
      },
    },
  });
}

// Content scripts must be iife: Chrome runs them as classic scripts, which
// cannot import other files, so everything has to be inlined into one file.
await buildScript('content/interceptor.ts', 'content/interceptor.js', 'iife');
await buildScript('content/detector.ts', 'content/detector.js', 'iife');

// The worker must be an ES module because manifest.json declares "type": "module".
await buildScript('background/index.ts', 'background/index.js', 'es');

// root is src/ so HTML output paths start below it: src/ui/popup/popup.html
// becomes dist/ui/popup/popup.html, not dist/src/ui/popup/popup.html.
await build({
  configFile: false,
  logLevel: 'warn',
  root: src,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: dist,
    emptyOutDir: false,
    rolldownOptions: {
      input: resolve(src, 'ui/popup/popup.html'),
    },
  },
});

// Copied, not generated, so world and run_at stay visible in one plain file.
await copyFile(resolve(projectRoot, 'manifest.json'), resolve(dist, 'manifest.json'));
