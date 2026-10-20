// Shared helpers for scripts/release.mjs and scripts/rollback.mjs.
// No dependencies: node built-ins only.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

const CHANGELOG_HEADER = `# Changelog

All notable changes to this plugin are documented here. Versions follow [SemVer](https://semver.org).
`;

export class UsageError extends Error {}

export function fail(message) {
  throw new UsageError(message);
}

// Runs the script body and maps failures to exit codes: 1 = expected failure, 2 = crash.
export function run(main) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    if (e instanceof UsageError) {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
    console.error(e.stack || e);
    process.exit(2);
  }
}

export function parseFlags(argv, spec) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (!(key in spec)) fail(`unknown option: ${arg}`);
    if (spec[key] === 'boolean') flags[key] = true;
    else {
      if (i + 1 >= argv.length) fail(`${arg} needs a value`);
      flags[key] = argv[++i];
    }
  }
  return { flags, positional };
}

// --- git --------------------------------------------------------------------

export function git(args, { input } = {}) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      input,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (e) {
    fail(`git ${args.join(' ')} failed: ${e.stderr?.trim() || e.message}`);
  }
}

export function gitOk(args) {
  try {
    execFileSync('git', args, { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export const currentBranch = () => git(['rev-parse', '--abbrev-ref', 'HEAD']);
export const isClean = (...paths) => git(['status', '--porcelain', '--', ...paths]) === '';

// --- semver -----------------------------------------------------------------

export function compareSemver(a, b) {
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

export function bumpVersion(current, kind) {
  if (SEMVER.test(kind)) return kind;
  const m = SEMVER.exec(current);
  if (!m) fail(`current version "${current}" is not semver`);
  const [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  // A pre-release bumps to its own release: 1.2.0-rc.1 -> 1.2.0.
  if (kind === 'patch') return m[4] ? `${major}.${minor}.${patch}` : `${major}.${minor}.${patch + 1}`;
  fail(`version must be major, minor, patch or X.Y.Z, got "${kind}"`);
}

export const maxVersion = (versions) => versions.reduce((max, v) => (!max || compareSemver(v, max) > 0 ? v : max), null);

// --- plugins ----------------------------------------------------------------

export const tagName = (plugin, version) => `${plugin}--v${version}`;

export function readJsonFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const indent = /^[{[]\r?\n([ \t]+)/.exec(text)?.[1] ?? '  ';
  return { data: JSON.parse(text), indent };
}

export function writeJsonFile(file, data, indent = '  ') {
  fs.writeFileSync(file, `${JSON.stringify(data, null, indent)}\n`);
}

// Changes only the "version" value so the rest of plugin.json keeps its formatting.
// Falls back to a full rewrite when "version" appears more than once (e.g. in dependencies).
export function setManifestVersion(file, version) {
  const text = fs.readFileSync(file, 'utf8');
  const pattern = /("version"\s*:\s*")[^"]*(")/g;
  if ((text.match(pattern) ?? []).length === 1) {
    fs.writeFileSync(file, text.replace(pattern, `$1${version}$2`));
    return;
  }
  const { data, indent } = readJsonFile(file);
  writeJsonFile(file, { ...data, version }, indent);
}

export function listPlugins() {
  const { data } = readJsonFile(path.join(ROOT, '.claude-plugin', 'marketplace.json'));
  return (data.plugins ?? []).filter((p) => typeof p.source === 'string').map((p) => p.name);
}

export function loadPlugin(name) {
  const { data: marketplace } = readJsonFile(path.join(ROOT, '.claude-plugin', 'marketplace.json'));
  const entry = (marketplace.plugins ?? []).find((p) => p.name === name);
  if (!entry) fail(`plugin "${name}" is not listed in .claude-plugin/marketplace.json`);
  if (typeof entry.source !== 'string') fail(`plugin "${name}" has an external source; release it in its own repository`);

  const dir = path.resolve(ROOT, entry.source);
  const relDir = path.relative(ROOT, dir).split(path.sep).join('/');
  const manifestPath = path.join(dir, '.claude-plugin', 'plugin.json');
  if (!fs.existsSync(manifestPath)) fail(`${relDir}/.claude-plugin/plugin.json is missing`);
  const { data: manifest, indent } = readJsonFile(manifestPath);
  if (!SEMVER.test(manifest.version ?? '')) fail(`${relDir}/.claude-plugin/plugin.json has no semver "version"`);

  return { name, dir, relDir, manifestPath, manifest, indent, changelogPath: path.join(dir, 'CHANGELOG.md') };
}

// Versions that already have a <plugin>--v<version> tag, highest first.
export function taggedVersions(name) {
  const prefix = `${name}--v`;
  return git(['tag', '--list', `${prefix}*`])
    .split('\n')
    .filter(Boolean)
    .map((t) => t.slice(prefix.length))
    .filter((v) => SEMVER.test(v))
    .sort((a, b) => compareSemver(b, a));
}

// --- changelog --------------------------------------------------------------

export const today = () => new Date().toISOString().slice(0, 10);

// Body of the "## [<version>]" (or "## <version>") section, without the heading.
export function changelogSection(text, version) {
  const lines = text.split(/\r?\n/);
  const escaped = version.replace(/[.+]/g, '\\$&');
  const start = lines.findIndex((l) => new RegExp(`^##\\s+\\[?${escaped}\\]?(\\s|$)`).test(l));
  if (start === -1) return '';
  const end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n').trim();
}

// Inserts a new section above the newest one, creating the file if needed.
export function addChangelogEntry(text, version, body) {
  const base = text?.trim() ? text : CHANGELOG_HEADER;
  if (new RegExp(`^##\\s+\\[?${version.replace(/[.+]/g, '\\$&')}\\]?(\\s|$)`, 'm').test(base)) {
    fail(`CHANGELOG.md already has a section for ${version}`);
  }
  const section = `## [${version}] - ${today()}\n\n${body.trim()}\n`;
  const lines = base.split('\n');
  const first = lines.findIndex((l) => /^##\s/.test(l));
  if (first === -1) return `${base.trimEnd()}\n\n${section}`;
  return [...lines.slice(0, first), section, ...lines.slice(first)].join('\n');
}
