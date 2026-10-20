#!/usr/bin/env node
// Structural linter for the marketplace. Covers cross-file checks that
// `claude plugin validate` does not do. No dependencies: node built-ins only.
//
// Usage: node scripts/validate-marketplace.mjs [--base <git-ref>] [--root <dir>]
//   --base  enables the version-bump check against that ref (used on PRs)
//   --root  marketplace root (default: the repository containing this script)
//
// Exit codes: 0 = ok (warnings allowed), 1 = errors found, 2 = linter crashed.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RESERVED_MARKETPLACE_NAMES = new Set([
  'claude-code-marketplace', 'claude-code-plugins', 'claude-plugins-official',
  'anthropic-marketplace', 'anthropic-plugins', 'agent-skills', 'anthropic-agent-skills',
  'life-sciences', 'knowledge-work-plugins', 'claude-for-legal',
  'claude-for-financial-services', 'financial-services-plugins', 'first-party-plugins',
  'claude-tag-plugins', 'claude-community', 'claude-plugins-community', 'healthcare',
  'anthropic-plugin-directory', 'claude-plugin-directory',
  'inline', 'builtin', 'skills-dir', 'synced', 'claude-plugin-test',
  'npm', 'pip', 'uv', 'cargo', 'github', 'gh',
]);
const RESERVED_PLUGIN_NAMES = new Set(['claude', 'anthropic', 'anthropics', 'claude-code', 'claude-mods']);
const RESERVED_PLUGIN_PREFIXES = ['claude-', 'anthropic-', 'anthropics-', 'cc-plugin-'];

const KEBAB = /^[a-z0-9][a-z0-9-]{1,63}$/;
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
const JUNK_FILES = new Set(['.DS_Store', 'Thumbs.db', '__MACOSX']);
const SKIP_DIRS = new Set(['.git', 'node_modules']);
const SCRIPT_EXT = /\.(sh|bash|py|js|mjs|cjs|ts|rb|pl)$/;
const MAX_TEXT_SIZE = 256 * 1024;

const SECRET_PATTERNS = [
  [/\/Users\/[A-Za-z0-9._-]+\//, 'absolute macOS home path'],
  [/\/home\/[A-Za-z0-9._-]+\//, 'absolute Linux home path'],
  [/[A-Za-z]:\\Users\\/, 'absolute Windows home path'],
  [/AKIA[0-9A-Z]{16}/, 'AWS access key id'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}/, 'GitHub token'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/, 'GitHub fine-grained token'],
  [/\bsk-ant-[A-Za-z0-9_-]{20,}/, 'Anthropic API key'],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/, 'Slack token'],
];

const errors = [];
const warnings = [];
const error = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

function parseArgs(argv) {
  const args = { base: null, root: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') args.base = argv[++i];
    else if (argv[i] === '--root') args.root = argv[++i];
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return args;
}

function readJson(file, where) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    error(where, `cannot parse JSON (${e.message})`);
    return null;
  }
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';
const rel = (root, p) => path.relative(root, p).split(path.sep).join('/');

function isInside(parent, child) {
  const r = path.relative(parent, child);
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r));
}

function walk(dir, visit) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    visit(full, entry);
    if (entry.isDirectory() && !entry.isSymbolicLink()) walk(full, visit);
  }
}

function compareSemver(a, b) {
  const pa = SEMVER.exec(a);
  const pb = SEMVER.exec(b);
  for (let i = 1; i <= 3; i++) {
    const d = Number(pa[i]) - Number(pb[i]);
    if (d !== 0) return d;
  }
  // A release ranks above any of its pre-releases.
  if (!pa[4] && pb[4]) return 1;
  if (pa[4] && !pb[4]) return -1;
  if (!pa[4] && !pb[4]) return 0;
  return pa[4].localeCompare(pb[4], 'en', { numeric: true });
}

// --- marketplace.json -------------------------------------------------------

function checkMarketplace(root) {
  const file = path.join(root, '.claude-plugin', 'marketplace.json');
  const where = '.claude-plugin/marketplace.json';
  if (!fs.existsSync(file)) {
    error(where, 'file is missing');
    return null;
  }
  const mp = readJson(file, where);
  if (!isObject(mp)) {
    if (mp !== null) error(where, 'top level must be an object');
    return null;
  }

  if (!isNonEmptyString(mp.name)) error(where, '"name" is required');
  else {
    if (!KEBAB.test(mp.name)) error(where, `"name" must be kebab-case (${KEBAB}), got "${mp.name}"`);
    if (RESERVED_MARKETPLACE_NAMES.has(mp.name.toLowerCase()) || mp.name.toLowerCase().startsWith('claudeai-')) {
      error(where, `"name" "${mp.name}" is reserved`);
    }
  }
  if (!isObject(mp.owner) || !isNonEmptyString(mp.owner.name)) error(where, '"owner.name" is required');
  if (!isNonEmptyString(mp.description)) warn(where, '"description" is missing');
  if (!Array.isArray(mp.plugins)) {
    error(where, '"plugins" must be an array');
    return null;
  }
  return mp;
}

// --- plugin entries ---------------------------------------------------------

function checkEntries(root, mp) {
  const where = '.claude-plugin/marketplace.json';
  const plugins = [];
  const seen = new Set();
  const names = [];

  mp.plugins.forEach((entry, i) => {
    const at = `${where} plugins[${i}]`;
    if (!isObject(entry)) {
      error(at, 'entry must be an object');
      return;
    }
    const { name, source } = entry;
    if (!isNonEmptyString(name)) {
      error(at, '"name" is required');
      return;
    }
    names.push(name);
    const label = `${where} "${name}"`;
    if (!KEBAB.test(name)) error(label, `name must match ${KEBAB}`);
    if (RESERVED_PLUGIN_NAMES.has(name) || RESERVED_PLUGIN_PREFIXES.some((p) => name.startsWith(p))) {
      error(label, 'name is reserved (claude-, anthropic-, anthropics-, cc-plugin- prefixes are not allowed)');
    }
    if (seen.has(name)) error(label, 'duplicate plugin name');
    seen.add(name);
    if ('version' in entry) {
      error(label, '"version" must live only in plugin.json, not in the marketplace entry');
    }
    if (!isNonEmptyString(entry.description)) warn(label, '"description" is missing');

    if (isObject(source)) {
      if (!source.sha) warn(label, `external "${source.source}" source is not pinned with "sha"`);
      return;
    }
    if (typeof source !== 'string') {
      error(label, '"source" is required');
      return;
    }
    if (!source.startsWith('./')) error(label, `relative source must start with "./", got "${source}"`);
    if (source.split(/[\\/]/).includes('..')) {
      error(label, 'source must not contain ".."');
      return;
    }
    if (source.includes('\\')) error(label, 'source must use forward slashes');
    const dir = path.resolve(root, source);
    if (!isInside(root, dir)) {
      error(label, 'source escapes the marketplace root');
      return;
    }
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      error(label, `source directory "${source}" does not exist`);
      return;
    }
    plugins.push({ name, dir });
  });

  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  if (names.some((n, i) => n !== sorted[i])) error(where, `plugins must be sorted by name: ${sorted.join(', ')}`);

  // Directories under plugins/ that the catalog never mentions.
  const pluginsDir = path.join(root, 'plugins');
  if (fs.existsSync(pluginsDir)) {
    const listed = new Set(plugins.map((p) => p.dir));
    for (const entry of fs.readdirSync(pluginsDir, { withFileTypes: true })) {
      if (entry.isDirectory() && !listed.has(path.join(pluginsDir, entry.name))) {
        warn(`plugins/${entry.name}`, 'directory is not listed in marketplace.json');
      }
    }
  }
  return plugins;
}

// --- plugin contents --------------------------------------------------------

function checkManifest(root, plugin) {
  const where = rel(root, path.join(plugin.dir, '.claude-plugin', 'plugin.json'));
  const file = path.join(plugin.dir, '.claude-plugin', 'plugin.json');
  if (!fs.existsSync(file)) {
    error(where, 'file is missing');
    return null;
  }
  const manifest = readJson(file, where);
  if (!isObject(manifest)) return null;

  if (manifest.name !== plugin.name) {
    error(where, `"name" is "${manifest.name}" but the marketplace entry is "${plugin.name}"`);
  }
  if (!isNonEmptyString(manifest.version)) error(where, '"version" is required');
  else if (!SEMVER.test(manifest.version)) error(where, `"version" must be semver, got "${manifest.version}"`);
  if (!isNonEmptyString(manifest.description)) error(where, '"description" is required');
  if (!isObject(manifest.author) || !isNonEmptyString(manifest.author.name)) error(where, '"author.name" is required');
  if (!isNonEmptyString(manifest.license)) error(where, '"license" is required (SPDX id)');
  if ('homepage' in manifest) {
    try {
      new URL(manifest.homepage);
    } catch {
      error(where, `"homepage" is not a valid URL, the plugin would fail to load`);
    }
  }
  // The catalog site searches keywords; Ukrainian queries rely on them because descriptions are in English.
  if (!('keywords' in manifest)) warn(where, '"keywords" is missing; add English and Ukrainian search terms');
  else if (!Array.isArray(manifest.keywords) || manifest.keywords.some((k) => !isNonEmptyString(k))) {
    error(where, '"keywords" must be an array of non-empty strings');
  } else if (manifest.keywords.length === 0) warn(where, '"keywords" is empty; add English and Ukrainian search terms');
  if ('repository' in manifest && typeof manifest.repository !== 'string') {
    error(where, '"repository" must be a string');
  }
  return manifest;
}

function checkLayout(root, plugin) {
  const where = rel(root, plugin.dir);
  if (fs.existsSync(path.join(plugin.dir, 'CLAUDE.md'))) {
    error(where, 'CLAUDE.md at the plugin root is not loaded by Claude Code; move the instructions into a skill');
  }
  if (fs.existsSync(path.join(plugin.dir, 'bin'))) {
    error(where, 'top-level bin/ is rejected by claude.ai org sync; use scripts/');
  }
  if (!fs.existsSync(path.join(plugin.dir, 'README.md'))) error(where, 'README.md is missing');

  walk(plugin.dir, (full, entry) => {
    const at = rel(root, full);
    if (JUNK_FILES.has(entry.name)) error(at, 'junk file must not be committed');
    if (entry.isSymbolicLink()) {
      const target = path.resolve(path.dirname(full), fs.readlinkSync(full));
      if (!isInside(plugin.dir, target)) error(at, 'symlink points outside the plugin and will not be copied to the cache');
      else warn(at, 'symlinks are rejected by the plugin directory; prefer a real file');
    }
  });
}

function checkHookCommand(at, command, args) {
  if (typeof command !== 'string') {
    error(at, 'hook "command" must be a string');
    return;
  }
  if (/(^|[^"'])\$\{?CLAUDE_PLUGIN_ROOT\}?/.test(command)) {
    error(at, `quote \${CLAUDE_PLUGIN_ROOT}, paths with spaces break otherwise: ${command}`);
  }
  // With exec form (args) the command is the interpreter itself.
  const first = Array.isArray(args) ? command : command.trim().split(/\s+/)[0].replace(/^["']|["']$/g, '');
  if (SCRIPT_EXT.test(first.replace(/["']/g, ''))) {
    error(at, `call scripts through an explicit interpreter (bash, node, python3): ${command}`);
  }
}

function checkHooks(root, plugin, manifest) {
  const file = path.join(plugin.dir, 'hooks', 'hooks.json');
  const sources = [];
  if (fs.existsSync(file)) {
    const where = rel(root, file);
    const json = readJson(file, where);
    if (json !== null) {
      if (!isObject(json) || !isObject(json.hooks)) error(where, 'must be wrapped in a top-level "hooks" object');
      else sources.push([where, json.hooks]);
    }
  }
  if (manifest && isObject(manifest.hooks)) sources.push([`${rel(root, plugin.dir)}/.claude-plugin/plugin.json hooks`, manifest.hooks]);
  if (manifest && manifest.hooks === './hooks/hooks.json') {
    warn(`${rel(root, plugin.dir)}/.claude-plugin/plugin.json`, 'hooks/hooks.json loads automatically; do not list it in "hooks"');
  }

  for (const [where, hooks] of sources) {
    for (const [event, groups] of Object.entries(hooks)) {
      if (!Array.isArray(groups)) {
        error(`${where} ${event}`, 'must be an array of matcher groups');
        continue;
      }
      groups.forEach((group, gi) => {
        (group?.hooks ?? []).forEach((hook, hi) => {
          if (hook?.type === 'command') checkHookCommand(`${where} ${event}[${gi}].hooks[${hi}]`, hook.command, hook.args);
        });
      });
    }
  }
}

function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(text);
  if (!m) return null;
  const fields = {};
  let current = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (kv) {
      current = kv[1];
      fields[current] = kv[2];
    } else if (current && /^\s/.test(line)) {
      fields[current] += `\n${line}`;
    }
  }
  return fields;
}

function unquote(value) {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

function checkSkills(root, plugin) {
  const files = [];
  if (fs.existsSync(path.join(plugin.dir, 'SKILL.md'))) files.push(path.join(plugin.dir, 'SKILL.md'));
  const skillsDir = path.join(plugin.dir, 'skills');
  if (fs.existsSync(skillsDir)) {
    walk(skillsDir, (full, entry) => {
      if (entry.isFile() && entry.name === 'SKILL.md') files.push(full);
    });
  }

  for (const file of files) {
    const where = rel(root, file);
    const fm = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    if (!fm) {
      error(where, 'YAML frontmatter is missing');
      continue;
    }
    const name = fm.name === undefined ? '' : unquote(fm.name);
    if (!name) error(where, 'frontmatter "name" is required');
    else {
      if (!/^[a-z0-9-]{1,64}$/.test(name)) error(where, 'frontmatter "name" must be lowercase letters, digits and hyphens, at most 64 chars');
      if (/claude|anthropic/.test(name)) error(where, 'frontmatter "name" must not contain "claude" or "anthropic"');
    }
    if (fm.description === undefined) {
      error(where, 'frontmatter "description" is required');
      continue;
    }
    const raw = fm.description.trim();
    if (raw.startsWith('-') || /^\s*-\s/m.test(raw.split('\n').slice(1).join('\n'))) {
      error(where, 'frontmatter "description" must be a single string, not a list');
      continue;
    }
    const description = /^[|>]/.test(raw) ? raw.replace(/^[|>][-+]?\s*/, '').replace(/\s+/g, ' ').trim() : unquote(raw.replace(/\s+/g, ' '));
    if (!description) error(where, 'frontmatter "description" is empty');
    else if (description.length > 1024) error(where, `frontmatter "description" is ${description.length} chars, max 1024`);
  }
}

function checkFiles(root, plugin) {
  walk(plugin.dir, (full, entry) => {
    if (!entry.isFile()) return;
    const at = rel(root, full);
    const buf = fs.readFileSync(full);
    if (buf.includes(0)) return; // binary
    if (buf.length > MAX_TEXT_SIZE) warn(at, `text file is larger than ${MAX_TEXT_SIZE / 1024} KiB`);

    const text = buf.toString('utf8');
    for (const [pattern, label] of SECRET_PATTERNS) {
      if (pattern.test(text)) error(at, `possible ${label}`);
    }
    if (text.startsWith('#!') && !(fs.statSync(full).mode & 0o111)) {
      warn(at, 'script has a shebang but no executable bit (git update-index --chmod=+x)');
    }
  });
}

// --- CODEOWNERS -------------------------------------------------------------

function checkCodeowners(root, plugins) {
  const file = ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS']
    .map((p) => path.join(root, p))
    .find((p) => fs.existsSync(p));
  if (!file) {
    error('CODEOWNERS', 'file is missing (.github/CODEOWNERS)');
    return;
  }
  // Simplified matching: catch-all patterns, plugins/ as a whole, or the plugin directory itself.
  const patterns = fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .filter((l) => l.split(/\s+/).length > 1)
    .map((l) => l.split(/\s+/)[0].replace(/^\//, '').replace(/(\/\*\*|\/\*|\/)$/, ''));

  for (const plugin of plugins) {
    const dir = rel(root, plugin.dir);
    const covered = patterns.some((p) => p === '*' || p === '**' || p === '' || dir === p || dir.startsWith(`${p}/`));
    if (!covered) error(rel(root, file), `no owner for ${dir}/`);
  }
}

// --- shared files -----------------------------------------------------------

// A plugin is self-contained, so a script used by several plugins is copied
// into each of them. Copies carry the SHARED_MARKER comment and must stay
// byte-identical across plugins, file by file name.
const SHARED_MARKER = 'This file is shared verbatim by';

function checkSharedFiles(root, plugins) {
  const byName = new Map();
  for (const plugin of plugins) {
    if (!fs.existsSync(plugin.dir)) continue;
    walk(plugin.dir, (file, entry) => {
      if (!entry.isFile() || !SCRIPT_EXT.test(entry.name)) return;
      const text = fs.readFileSync(file, 'utf8');
      if (!text.includes(SHARED_MARKER)) return;
      if (!byName.has(entry.name)) byName.set(entry.name, []);
      byName.get(entry.name).push({ file, text });
    });
  }
  for (const [name, copies] of byName) {
    const [first, ...rest] = copies;
    for (const copy of rest) {
      if (copy.text !== first.text) {
        error(rel(root, copy.file), `shared file differs from ${rel(root, first.file)}; copy ${name} verbatim to every plugin`);
      }
    }
  }
}

// --- version bump -----------------------------------------------------------

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function checkVersionBump(root, plugins, manifests, base) {
  let changed;
  try {
    changed = git(root, ['diff', '--name-only', `${base}...HEAD`]).split('\n').filter(Boolean);
  } catch (e) {
    error('version-bump', `cannot diff against "${base}": ${e.stderr?.trim() || e.message}`);
    return;
  }

  for (const plugin of plugins) {
    const dir = rel(root, plugin.dir);
    if (!changed.some((f) => f.startsWith(`${dir}/`))) continue;
    const current = manifests.get(plugin.name)?.version;
    if (!current || !SEMVER.test(current)) continue; // already reported by checkManifest

    let previous;
    try {
      previous = JSON.parse(git(root, ['show', `${base}:${dir}/.claude-plugin/plugin.json`])).version;
    } catch {
      continue; // new plugin, nothing to compare with
    }
    if (!SEMVER.test(previous ?? '')) continue;
    if (compareSemver(current, previous) <= 0) {
      error(`${dir}/.claude-plugin/plugin.json`, `files changed but "version" ${current} is not greater than ${previous} on ${base}`);
    }
  }
}

// --- main -------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.root ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));

  const mp = checkMarketplace(root);
  if (mp) {
    const plugins = checkEntries(root, mp);
    const manifests = new Map();
    for (const plugin of plugins) {
      const manifest = checkManifest(root, plugin);
      if (manifest) manifests.set(plugin.name, manifest);
      checkLayout(root, plugin);
      checkHooks(root, plugin, manifest);
      checkSkills(root, plugin);
      checkFiles(root, plugin);
    }
    checkCodeowners(root, plugins);
    checkSharedFiles(root, plugins);
    if (args.base) checkVersionBump(root, plugins, manifests, args.base);
    console.log(`Checked marketplace "${mp.name ?? '?'}" with ${mp.plugins.length} plugin(s).`);
  }

  for (const w of warnings) console.log(`warning: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);
  if (errors.length) {
    console.error(`\n${errors.length} error(s), ${warnings.length} warning(s).`);
    process.exit(1);
  }
  console.log(warnings.length ? `Passed with ${warnings.length} warning(s).` : 'Passed.');
}

try {
  main();
} catch (e) {
  console.error(`validate-marketplace crashed: ${e.stack || e}`);
  process.exit(2);
}
