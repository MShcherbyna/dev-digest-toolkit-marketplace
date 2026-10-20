import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { marketplaceInfo } from './scripts/lib/repo-info.mjs';

const siteDir = path.dirname(fileURLToPath(import.meta.url));

// No inline scripts or styles in the build, so the policy can stay strict. README images may be
// hosted anywhere (badges), hence https: for img-src. Dev server injects inline styles, so build only.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' https: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const csp = (): Plugin => ({
  name: 'catalog-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta charset="utf-8" />', `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

export default defineConfig({
  // Relative base: works under https://<owner>.github.io/<repo>/ and in `vite preview` alike.
  base: './',
  plugins: [preact(), csp()],
  define: {
    __MARKETPLACE__: JSON.stringify(marketplaceInfo(path.resolve(siteDir, '..'))),
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
