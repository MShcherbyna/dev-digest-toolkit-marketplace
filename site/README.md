# Catalog site

A static site for the marketplace on GitHub Pages: search across plugins, skills, agents, commands, hooks and MCP servers, result cards with **Copy install**, plugin and component pages, "What's new" with an Atom feed, catalog stats and onboarding.

The site has two languages: English is the main version (`#/…`) and Ukrainian lives under `#/uk/…`. The EN/UK switch in the header opens the same page with the same query and filters. Strings are in `src/i18n/en.ts` and `src/i18n/uk.ts`; both share one type, so a missing translation fails the typecheck.

URL: https://mshcherbyna.github.io/dev-digest-toolkit-marketplace/

Spec: [docs/specs/catalog-site.md](../docs/specs/catalog-site.md). Design: [docs/design/Catalog.dc.html](../docs/design/Catalog.dc.html).

The site is a separate project: it has its own `package.json`, reads the marketplace files and never writes to them.

## How it works

There is no backend. Everything that needs processing happens at build time:

1. `scripts/build-catalog.mjs` reads `.claude-plugin/marketplace.json` and `plugins/*` (plugin.json, README, SKILL.md, agents, commands, hooks, `.mcp.json`, CHANGELOG.md, git tags `<name>--v<version>`) and writes:
   - `public/data/catalog.json`: the catalog, with README and skill bodies already rendered to sanitized HTML;
   - `public/data/search-index.json`: a serialized [MiniSearch](https://github.com/lucaong/minisearch) index;
   - `public/feed.xml`: an Atom feed of releases.
2. Vite builds the Preact app into `dist/`. Routing uses the hash (`#/plugin/<name>`), so Pages needs no SPA fallback, and `base: './'` lets the site work under any path.
3. [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) publishes `dist/` to Pages on every push to `main` that touches `plugins/`, `.claude-plugin/` or `site/`, and on every release tag.

The page makes no requests outside the site: no CDN, no GitHub API, fonts are bundled. The build adds a strict Content-Security-Policy meta tag.

## Development

```bash
cd site
npm ci
npm run dev:demo   # dev server on the demo marketplace in test/fixtures/marketplace
npm run dev        # dev server on this repository's real catalog
```

| Command | What it does |
|---|---|
| `npm run catalog` | generate the data from the repository |
| `npm run build` | data + production build into `dist/` |
| `npm run preview` | serve `dist/` locally |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | generator tests (`node --test`) and search tests (Vitest) |
| `npm run e2e` | Playwright against a build of the demo marketplace, desktop and mobile |

Before the first `npm run e2e`: `npx playwright install chromium`.

CI: the **Catalog site** workflow (`.github/workflows/site.yml`) runs on every pull request and push to `main`, separately from **Validate marketplace**. It has two checks: `site-build` (typecheck, unit tests, build against the real catalog) and `site-e2e` (Playwright against the demo fixture; on failure the screenshots are uploaded as the `playwright-results` artifact).

## Search

- Queries are normalized (case, `ё→е`, apostrophes `’ ʼ '`) and filler words (`мені`, `треба`, `для`, `need`, ...) are dropped: `src/search/stopwords.ts`.
- Type words (`скіл`, `агент`, `хук`, `команда`, `mcp`, `плагін` and English forms) become a type filter, which the user can remove.
- Synonyms and Ukrainian stems live in `src/search/synonyms.json`. Add a group when a reasonable query finds nothing.
- Items matching every word come first; when none do, the search falls back to items matching any word.
- Skills and agents inherit their plugin's `keywords`, so bilingual `keywords` in `plugin.json` matter most for Ukrainian queries.

## Layout

```
site/
├── scripts/            data generator (Node only)
│   ├── build-catalog.mjs
│   ├── lib/            plugin components, markdown, releases, feed
│   └── test/
├── src/                the app (Preact + TypeScript)
│   ├── pages/          home, search, plugin, component, what's new, onboarding
│   ├── components/
│   ├── i18n/           English and Ukrainian strings
│   └── search/         index options, query parsing, ranking
├── e2e/                Playwright
└── test/fixtures/marketplace/   demo marketplace for dev and tests
```

## First-time Pages setup

Settings → Pages → Build and deployment → Source: **GitHub Actions**. After that, a push to `main` or a manual run of **Deploy catalog site** publishes the site.
