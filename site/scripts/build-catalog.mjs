#!/usr/bin/env node
// Builds the data behind the catalog site from the marketplace repository.
// It does not validate: broken plugins are caught by scripts/validate-marketplace.mjs.
//
// Usage: node scripts/build-catalog.mjs [--root <dir>] [--out <dir>] [--repo owner/name] [--site-url <url>]
//   --root      marketplace root (default: the repository containing site/)
//   --out       output directory (default: site/public)
//   --repo      GitHub repository for links (default: GITHUB_REPOSITORY or the origin remote)
//   --site-url  public site URL for the Atom feed (default: SITE_URL)
//
// Writes <out>/data/catalog.json, <out>/data/search-index.json and <out>/feed.xml.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MiniSearch from 'minisearch';
import { readMarketplace, detectRepo, DEFAULT_BRANCH } from './lib/repo-info.mjs';
import { collectComponents } from './lib/components.mjs';
import { renderMarkdown, htmlToText } from './lib/markdown.mjs';
import { pluginReleases, lastUpdated, headCommit, isGitRepo } from './lib/releases.mjs';
import { atomFeed } from './lib/feed.mjs';
import { INDEX_OPTIONS } from '../src/search/index-options.js';

export const SCHEMA_VERSION = 1;
const STAT_KEY = { skill: 'skills', agent: 'agents', command: 'commands', hook: 'hooks', mcp: 'mcp' };
const RELEASES_LIMIT = 50;
const BODY_TEXT_LIMIT = 5000;

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const m = /^--([\w-]+)$/.exec(argv[i]);
    if (!m) throw new Error(`unknown argument: ${argv[i]}`);
    args[m[1]] = argv[++i];
  }
  return args;
}

const unique = (list) => [...new Set(list.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()))];

function readJson(file, warn) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    warn(`${file}: ${e.message}`);
    return null;
  }
}

function pluginDirFor(root, mp, entry) {
  if (typeof entry.source !== 'string') return null;
  const pluginRoot = mp.metadata?.pluginRoot ?? '.';
  const source = entry.source.startsWith('./') || entry.source.startsWith('../') ? entry.source : path.join(pluginRoot, entry.source);
  const dir = path.resolve(root, source);
  return dir.startsWith(root) && fs.existsSync(dir) ? dir : null;
}

/**
 * @param {{ root: string, repo?: string | null, siteUrl?: string | null, now?: Date }} options
 */
export function buildCatalog({ root, repo = null, siteUrl = null, now = new Date() }) {
  root = path.resolve(root);
  const warnings = [];
  const warn = (msg) => warnings.push(msg);
  const mp = readMarketplace(root);
  const ctx = { root, repo, repoPrefix: '', git: isGitRepo(root) };
  const repoUrl = repo ? `https://github.com/${repo}` : null;

  const plugins = [];
  for (const entry of [...(mp.plugins ?? [])].sort((a, b) => String(a.name).localeCompare(String(b.name)))) {
    const dir = pluginDirFor(root, mp, entry);
    const manifestFile = dir && path.join(dir, '.claude-plugin', 'plugin.json');
    const manifest = (manifestFile && fs.existsSync(manifestFile) && readJson(manifestFile, warn)) || {};
    if (!dir) warn(`${entry.name}: source is not a local directory, only the marketplace entry is shown`);

    const name = entry.name;
    const version = manifest.version ?? entry.version ?? '0.0.0';
    const relDir = dir ? path.relative(root, dir).split(path.sep).join('/') : null;
    const readmeFile = dir && path.join(dir, 'README.md');
    const readmeHtml = readmeFile && fs.existsSync(readmeFile) ? renderMarkdown(fs.readFileSync(readmeFile, 'utf8'), { repo, filePath: `${relDir}/README.md` }) : '';
    const components = dir ? collectComponents({ pluginName: name, pluginDir: dir, manifest, ctx, warn }) : [];
    const releases = dir ? pluginReleases({ root, pluginName: name, pluginDir: dir, version, ctx }) : [];
    const userConfig = Object.entries(manifest.userConfig ?? {}).map(([key, cfg]) => ({
      key,
      description: String(cfg?.description ?? ''),
      sensitive: cfg?.sensitive === true,
    }));

    plugins.push({
      name,
      displayName: manifest.displayName ?? entry.displayName ?? name,
      description: manifest.description ?? entry.description ?? '',
      version,
      author: { name: manifest.author?.name ?? entry.author?.name ?? mp.owner?.name ?? '' },
      license: manifest.license ?? entry.license ?? null,
      homepage: manifest.homepage ?? entry.homepage ?? null,
      keywords: unique([...(manifest.keywords ?? []), ...(entry.keywords ?? []), ...(entry.tags ?? [])]),
      category: entry.category ?? manifest.category ?? null,
      dependencies: (entry.dependencies ?? manifest.dependencies ?? []).map((d) => (typeof d === 'string' ? d : d?.name)).filter(Boolean),
      install: `/plugin install ${name}@${mp.name}`,
      sourceUrl: repoUrl && relDir ? `${repoUrl}/tree/${DEFAULT_BRANCH}/${relDir}` : null,
      updated: dir ? lastUpdated(root, dir, ctx) ?? releases[0]?.date ?? null : null,
      readmeHtml,
      userConfig,
      components,
      releases,
    });
  }

  // Search documents: one per plugin and per component. Components inherit the plugin keywords.
  const docs = [];
  for (const p of plugins) {
    docs.push({
      id: `${p.name}/plugin`,
      name: `${p.name} ${p.displayName}`,
      keywords: [...p.keywords, p.category ?? ''].join(' '),
      description: p.description,
      body: htmlToText(p.readmeHtml).slice(0, BODY_TEXT_LIMIT),
    });
    for (const c of p.components) {
      docs.push({
        id: c.id,
        name: `${c.name} ${c.displayName}`,
        keywords: [...p.keywords, p.name].join(' '),
        description: c.description,
        body: c.bodyText,
      });
    }
  }
  const index = new MiniSearch(INDEX_OPTIONS);
  index.addAll(docs);

  const stats = { plugins: plugins.length, skills: 0, agents: 0, commands: 0, hooks: 0, mcp: 0 };
  for (const p of plugins) for (const c of p.components) stats[STAT_KEY[c.type]]++;

  const byName = new Map(plugins.map((p) => [p.name, p]));
  const allReleases = plugins
    .flatMap((p) => p.releases.map((r) => ({ ...r, displayName: p.displayName })))
    // Newest first by tag time; releases known only by date sort after timed ones of that day.
    .sort((a, b) => (b.time ?? b.date ?? '').localeCompare(a.time ?? a.date ?? '') || a.plugin.localeCompare(b.plugin))
    .slice(0, RELEASES_LIMIT);

  const generatedAt = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const marketplace = { name: mp.name, description: mp.description ?? '', owner: mp.owner?.name ?? '', repo, repoUrl };
  const catalog = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    commit: ctx.git ? headCommit(root) : null,
    marketplace,
    stats,
    plugins: plugins.map(({ components, ...p }) => ({ ...p, components: components.map(({ bodyText, ...c }) => c) })),
    releases: allReleases,
  };
  for (const p of plugins) {
    for (const dep of p.dependencies) if (!byName.has(dep.split('@')[0])) warn(`${p.name}: dependency "${dep}" is not in this marketplace`);
  }

  return {
    catalog,
    searchIndex: index.toJSON(),
    feed: atomFeed({ marketplace, releases: allReleases, siteUrl, generatedAt }),
    warnings,
    documentCount: docs.length,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.root ?? path.join(siteDir, '..'));
  const out = path.resolve(args.out ?? path.join(siteDir, 'public'));
  const repo = args.repo ?? detectRepo(root);
  const { catalog, searchIndex, feed, warnings, documentCount } = buildCatalog({ root, repo, siteUrl: args['site-url'] ?? process.env.SITE_URL ?? null });

  fs.mkdirSync(path.join(out, 'data'), { recursive: true });
  fs.writeFileSync(path.join(out, 'data', 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  fs.writeFileSync(path.join(out, 'data', 'search-index.json'), JSON.stringify(searchIndex));
  fs.writeFileSync(path.join(out, 'feed.xml'), feed);

  for (const w of warnings) console.log(`warning: ${w}`);
  console.log(`Catalog "${catalog.marketplace.name}": ${catalog.stats.plugins} plugin(s), ${documentCount} searchable item(s) → ${path.relative(process.cwd(), out) || '.'}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    console.error(`build-catalog failed: ${e.stack || e}`);
    process.exit(1);
  }
}
