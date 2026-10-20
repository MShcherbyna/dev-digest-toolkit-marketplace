import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from '../build-catalog.mjs';
import { parseChangelog } from '../lib/releases.mjs';

const fixture = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../test/fixtures/marketplace');
const repo = 'owner/repo';

/** Copies the fixture into a fresh git repository so tags and dates are deterministic. */
function gitFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-'));
  fs.cpSync(fixture, dir, { recursive: true });
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { stdio: 'pipe', env: { ...process.env, GIT_COMMITTER_DATE: '2026-09-01T12:00:00Z', GIT_AUTHOR_DATE: '2026-09-01T12:00:00Z' } });
  git('init', '-q', '-b', 'main');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'init');
  git('tag', 'commit-helper--v0.3.0');
  return dir;
}

test('collects plugins and every component kind', () => {
  const { catalog, documentCount } = buildCatalog({ root: fixture, repo });
  assert.deepEqual(catalog.plugins.map((p) => p.name), ['commit-helper', 'docs-writer', 'pr-review']);
  assert.deepEqual(catalog.stats, { plugins: 3, skills: 3, agents: 2, commands: 2, hooks: 2, mcp: 1 });
  const total = Object.values(catalog.stats).reduce((a, b) => a + b, 0);
  assert.equal(documentCount, total, 'stats add up to the number of search documents');

  const pr = catalog.plugins.find((p) => p.name === 'pr-review');
  assert.equal(pr.install, '/plugin install pr-review@dev-digest-toolkit');
  assert.equal(pr.sourceUrl, 'https://github.com/owner/repo/tree/main/plugins/pr-review');
  const skill = pr.components.find((c) => c.id === 'pr-review/skill/review-diff');
  assert.equal(skill.invocation, '/pr-review:review-diff');
  assert.deepEqual(skill.tools, ['Read', 'Grep', 'Bash(git diff:*)']);
  assert.equal(pr.components.find((c) => c.name === 'review-checklist').invocation, '', 'user-invocable: false has no slash command');
  assert.deepEqual(pr.userConfig.map((u) => [u.key, u.sensitive]), [['github_token', true], ['max_files', false]]);
  const mcp = pr.components.find((c) => c.type === 'mcp');
  assert.equal(mcp.meta.env, 'GITHUB_TOKEN', 'only env names, never values');
});

test('sanitizes markdown and rewrites relative links', () => {
  const { catalog } = buildCatalog({ root: fixture, repo });
  const html = catalog.plugins.find((p) => p.name === 'pr-review').readmeHtml;
  assert.doesNotMatch(html, /<script/i);
  assert.match(html, /href="https:\/\/github\.com\/owner\/repo\/blob\/main\/plugins\/pr-review\/docs\/checklist\.md"/);
  assert.match(html, /src="https:\/\/raw\.githubusercontent\.com\/owner\/repo\/main\/plugins\/pr-review\/docs\/diagram\.png"/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test('releases come from CHANGELOG, tags, or an "added" record', () => {
  const dir = gitFixture();
  try {
    const { catalog, feed } = buildCatalog({ root: dir, repo, siteUrl: 'https://owner.github.io/repo/' });
    const pr = catalog.plugins.find((p) => p.name === 'pr-review');
    assert.deepEqual(pr.releases.map((r) => [r.version, r.kind, r.date]), [
      ['1.2.0', 'updated', '2026-10-01'],
      ['1.1.0', 'updated', '2026-09-12'],
      ['1.0.0', 'added', '2026-08-20'],
    ]);
    const commit = catalog.plugins.find((p) => p.name === 'commit-helper');
    assert.deepEqual(commit.releases.map((r) => [r.version, r.tag, r.date]), [['0.3.0', 'commit-helper--v0.3.0', '2026-09-01']]);
    const docs = catalog.plugins.find((p) => p.name === 'docs-writer');
    assert.deepEqual(docs.releases.map((r) => [r.version, r.kind, r.date]), [['2.0.0', 'added', '2026-09-01']]);
    assert.equal(catalog.releases[0].plugin, 'pr-review', 'newest release first');
    assert.match(feed, /<link href="https:\/\/owner\.github\.io\/repo\/#\/plugin\/pr-review"\/>/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an empty marketplace still builds', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-empty-'));
  try {
    fs.mkdirSync(path.join(dir, '.claude-plugin'));
    fs.writeFileSync(path.join(dir, '.claude-plugin', 'marketplace.json'), JSON.stringify({ name: 'm', owner: { name: 'o' }, plugins: [] }));
    const { catalog, documentCount } = buildCatalog({ root: dir });
    assert.equal(catalog.plugins.length, 0);
    assert.equal(documentCount, 0);
    assert.equal(catalog.marketplace.repoUrl, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('parseChangelog reads common heading styles', () => {
  const sections = parseChangelog('# Changelog\n\n## [1.1.0] - 2026-01-02\n- a\n\n## v1.0.0\n- b\n\n## Unreleased\n- c\n');
  assert.deepEqual(sections, [
    { version: '1.1.0', date: '2026-01-02', markdown: '- a' },
    { version: '1.0.0', date: null, markdown: '- b' },
  ]);
});

test('custom agents/commands paths replace the defaults, custom skills add to them', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-paths-'));
  try {
    fs.cpSync(fixture, dir, { recursive: true });
    const plugin = path.join(dir, 'plugins', 'docs-writer');
    fs.mkdirSync(path.join(plugin, 'extra-agents'));
    fs.writeFileSync(path.join(plugin, 'extra-agents', 'editor.md'), '---\nname: editor\ndescription: Edits.\n---\n');
    fs.mkdirSync(path.join(plugin, 'extra-skills', 'glossary'), { recursive: true });
    fs.writeFileSync(path.join(plugin, 'extra-skills', 'glossary', 'SKILL.md'), '---\nname: glossary\ndescription: Terms.\n---\n');
    const manifestFile = path.join(plugin, '.claude-plugin', 'plugin.json');
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    fs.writeFileSync(manifestFile, JSON.stringify({ ...manifest, agents: './extra-agents', skills: ['./extra-skills'] }));
    const { catalog } = buildCatalog({ root: dir });
    const names = catalog.plugins.find((p) => p.name === 'docs-writer').components.map((c) => `${c.type}:${c.name}`);
    assert.deepEqual(names.sort(), ['agent:editor', 'skill:api-docs', 'skill:glossary']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
