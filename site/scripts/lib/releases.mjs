// Release history: git tags `<name>--v<version>` first, CHANGELOG.md sections next,
// and an "added" record when a plugin has neither.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { renderMarkdown, htmlToText } from './markdown.mjs';

function git(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

/**
 * True only when `root` is the top of a git work tree. A marketplace nested inside another
 * repository (the demo fixture) must not pick up that repository's tags and commit dates.
 */
export function isGitRepo(root) {
  const top = git(root, ['rev-parse', '--show-toplevel']);
  return top !== '' && fs.realpathSync(top) === fs.realpathSync(root);
}

function compareSemver(a, b) {
  const pa = a.split(/[.-]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  const pb = b.split(/[.-]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1;
  // A pre-release sorts before the release it precedes.
  if (pa.length !== pb.length) return pa.length > pb.length ? -1 : 1;
  return String(a).localeCompare(String(b), 'en', { numeric: true });
}

/** `## 1.2.0`, `## [1.2.0]`, `## v1.2.0 - 2026-10-01` → { version, date, markdown } */
export function parseChangelog(text) {
  const sections = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const h = /^##\s+\[?v?(\d+\.\d+\.\d+[^\]\s]*)\]?(?:\s*[-–—(]\s*(\d{4}-\d{2}-\d{2})\)?)?/.exec(line);
    if (h) {
      current = { version: h[1], date: h[2] ?? null, lines: [] };
      sections.push(current);
    } else if (/^##\s/.test(line)) {
      current = null;
    } else if (current) {
      current.lines.push(line);
    }
  }
  return sections.map(({ lines, ...s }) => ({ ...s, markdown: lines.join('\n').trim() }));
}

export function pluginReleases({ root, pluginName, pluginDir, version, ctx }) {
  const byVersion = new Map();
  const changelogFile = path.join(pluginDir, 'CHANGELOG.md');
  const changelog = fs.existsSync(changelogFile) ? parseChangelog(fs.readFileSync(changelogFile, 'utf8')) : [];
  const notesFor = (v) => changelog.find((s) => s.version === v);
  const changelogPath = path.relative(root, changelogFile).split(path.sep).join('/');
  const toHtml = (md) => renderMarkdown(md, { repo: ctx.repo, filePath: changelogPath });

  if (ctx.git) {
    const prefix = `${pluginName}--v`;
    // creatordate is when an annotated tag was made (the commit date for a lightweight tag),
    // so releases tagged on the same day still sort by time.
    const refs = git(root, ['for-each-ref', '--format=%(refname:short)%09%(creatordate:iso-strict)', `refs/tags/${prefix}*`]);
    for (const [tag, created] of refs.split('\n').filter(Boolean).map((l) => l.split('\t'))) {
      const v = tag.slice(prefix.length);
      const time = created ? new Date(created).toISOString().replace(/\.\d{3}Z$/, 'Z') : null;
      const section = notesFor(v);
      const notes = section?.markdown || git(root, ['log', '-1', '--format=%s', tag]);
      byVersion.set(v, { version: v, tag, date: time?.slice(0, 10) || section?.date || null, time, notesHtml: toHtml(notes) });
    }
  }
  for (const section of changelog) {
    if (byVersion.has(section.version)) continue;
    byVersion.set(section.version, { version: section.version, tag: null, date: section.date, time: null, notesHtml: toHtml(section.markdown) });
  }
  if (byVersion.size === 0) {
    const relDir = path.relative(root, pluginDir);
    const added = ctx.git ? git(root, ['log', '--diff-filter=A', '--format=%cs', '--reverse', '--', relDir]).split('\n')[0] : '';
    byVersion.set(version, { version, tag: null, date: added || null, time: null, notesHtml: '' });
  }

  const releases = [...byVersion.values()].sort((a, b) => compareSemver(b.version, a.version));
  const first = releases[releases.length - 1];
  return releases.map((r) => ({ ...r, plugin: pluginName, kind: r === first ? 'added' : 'updated', summary: htmlToText(r.notesHtml).slice(0, 200) }));
}

/** Date of the last commit that touched the plugin directory. */
export function lastUpdated(root, pluginDir, ctx) {
  if (!ctx.git) return null;
  return git(root, ['log', '-1', '--format=%cs', '--', path.relative(root, pluginDir)]) || null;
}

export function headCommit(root) {
  return git(root, ['rev-parse', '--short', 'HEAD']) || null;
}
