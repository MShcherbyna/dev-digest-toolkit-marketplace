#!/usr/bin/env node
// Collect the working-tree change (tracked diff + untracked files) into ONE
// markdown file, so the reviewer agents read a single bundle instead of each
// re-running git diff and re-reading every file. Deterministic, read-only on
// the repository, no LLM.
//
// Usage: node review-bundle.mjs <out-file> [base-ref]     (default base: HEAD)
//
// Excludes: `reviewBundleExcludes` (git pathspec globs) from
// .claude/sdd-engineering.json in the repository root; lockfiles when unset.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const MAX_FILE_LINES = 400; // per untracked file
const MAX_DIFF_LINES = 6000; // tracked diff
const DEFAULT_EXCLUDES = ['**/package-lock.json', '**/pnpm-lock.yaml', '**/yarn.lock', '**/bun.lock'];

const [out, base = 'HEAD'] = process.argv.slice(2);
if (!out) {
  process.stderr.write('usage: node review-bundle.mjs <out-file> [base-ref]\n');
  process.exit(1);
}

const git = (args, opts = {}) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });

let root;
try {
  root = git(['rev-parse', '--show-toplevel']).trim();
} catch {
  process.stderr.write('review-bundle: not inside a git repository\n');
  process.exit(1);
}

const excludes = loadExcludes(root);
const pathspec = ['--', '.', ...excludes.map((e) => `:(exclude,glob)${e}`)];
const fence = (lang, body) => `\`\`\`${lang}\n${body.replace(/\n$/, '')}\n\`\`\``;
const outPath = path.resolve(out);
const outRel = path.relative(root, outPath).split(path.sep).join('/');

const lines = [];
lines.push('# Review bundle', '');
lines.push(`- base: \`${base}\` (${git(['rev-parse', '--short', base], { cwd: root }).trim()})`);
lines.push(`- branch: \`${git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root }).trim()}\``);
lines.push(`- generated: ${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}`);
lines.push(`- excluded: ${excludes.length ? excludes.join(', ') : 'nothing'}`);
lines.push(`- caps: ${MAX_DIFF_LINES} diff lines, ${MAX_FILE_LINES} lines per untracked file; when a marker says truncated, open the file`);
lines.push('');

lines.push('## git status (porcelain)');
lines.push(fence('', git(['status', '--porcelain', '--untracked-files=all', ...pathspec], { cwd: root })));
lines.push('');

lines.push('## Tracked changes: diff --stat');
lines.push(fence('', git(['diff', '--stat', base, ...pathspec], { cwd: root })));
lines.push('');

const diff = git(['diff', base, ...pathspec], { cwd: root }).split('\n');
if (diff.at(-1) === '') diff.pop();
let diffBody = diff.slice(0, MAX_DIFF_LINES).join('\n');
if (diff.length > MAX_DIFF_LINES) diffBody += `\n... TRUNCATED: ${diff.length} diff lines, showing ${MAX_DIFF_LINES}`;
lines.push('## Tracked changes: diff');
lines.push(fence('diff', diffBody));
lines.push('');

lines.push('## Untracked files (full content, capped)');
const untracked = git(['ls-files', '--others', '--exclude-standard', ...pathspec], { cwd: root })
  .split('\n')
  .filter(Boolean)
  .filter((f) => f !== outRel);
for (const f of untracked) {
  const abs = path.join(root, f);
  if (!fs.statSync(abs, { throwIfNoEntry: false })?.isFile()) continue;
  const buf = fs.readFileSync(abs);
  if (buf.length === 0 || buf.includes(0)) {
    lines.push('', `### ${f} (binary or empty, skipped)`);
    continue;
  }
  const text = buf.toString('utf8').split('\n');
  if (text.at(-1) === '') text.pop();
  let body = text.slice(0, MAX_FILE_LINES).join('\n');
  if (text.length > MAX_FILE_LINES) body += `\n... TRUNCATED: ${text.length} lines, showing ${MAX_FILE_LINES}`;
  lines.push('', `### ${f} (${text.length} lines)`, fence('', body));
}

const content = `${lines.join('\n')}\n`;
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, content);
process.stdout.write(`wrote ${out} (${Buffer.byteLength(content)} bytes, ${content.split('\n').length - 1} lines)\n`);

function loadExcludes(repoRoot) {
  const file = path.join(repoRoot, '.claude', 'sdd-engineering.json');
  if (!fs.existsSync(file)) return DEFAULT_EXCLUDES;
  let config;
  try {
    config = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    process.stderr.write(`review-bundle: cannot parse ${file} (${e.message})\n`);
    process.exit(1);
  }
  const list = config?.reviewBundleExcludes;
  if (list === undefined) return DEFAULT_EXCLUDES;
  if (!Array.isArray(list) || list.some((e) => typeof e !== 'string' || !e.trim())) {
    process.stderr.write(`review-bundle: "reviewBundleExcludes" in ${file} must be an array of non-empty strings\n`);
    process.exit(1);
  }
  return list;
}
