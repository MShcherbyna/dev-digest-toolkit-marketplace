#!/usr/bin/env node
// Rolls a plugin back to an earlier release, see docs/RELEASES.md.
//
//   node scripts/rollback.mjs <plugin> <target-version> [--version X.Y.Z] [--dry-run]
//
// Claude Code never treats a lower version as an update, so a rollback is a roll-forward:
// the plugin directory is restored from the <plugin>--v<target-version> tag and released
// under a new, higher version (next patch by default). CHANGELOG.md keeps its full history
// and gets a section that records the rollback. Changes are staged, not committed.

import fs from 'node:fs';
import {
  addChangelogEntry, bumpVersion, compareSemver, fail, git, gitOk, isClean, loadPlugin,
  maxVersion, parseFlags, run, SEMVER, setManifestVersion, tagName, taggedVersions,
} from './lib/release-utils.mjs';

const USAGE = 'usage: node scripts/rollback.mjs <plugin> <target-version> [--version X.Y.Z] [--dry-run]';

run((argv) => {
  const { flags, positional } = parseFlags(argv, { version: 'string', 'dry-run': 'boolean' });
  const [name, target] = positional;
  if (!name || !target || positional.length > 2) fail(USAGE);
  if (!SEMVER.test(target)) fail(`target version must be X.Y.Z, got "${target}"`);

  const plugin = loadPlugin(name);
  const current = plugin.manifest.version;
  const targetTag = tagName(name, target);
  if (!gitOk(['rev-parse', '--quiet', '--verify', `refs/tags/${targetTag}`])) {
    const known = taggedVersions(name);
    fail(`tag ${targetTag} does not exist${known.length ? `; released versions: ${known.join(', ')}` : ''}`);
  }
  if (!gitOk(['cat-file', '-e', `${targetTag}:${plugin.relDir}/.claude-plugin/plugin.json`])) {
    fail(`${plugin.relDir} has no plugin.json at ${targetTag}`);
  }
  if (compareSemver(target, current) >= 0) fail(`target ${target} is not older than the current version ${current}`);
  if (!isClean(plugin.relDir)) fail(`${plugin.relDir} has uncommitted changes`);

  const highest = maxVersion([current, ...taggedVersions(name)]);
  const next = flags.version ?? bumpVersion(highest, 'patch');
  if (!SEMVER.test(next)) fail(`--version must be X.Y.Z, got "${next}"`);
  if (compareSemver(next, highest) <= 0) fail(`new version ${next} must be greater than ${highest}`);

  const changelog = fs.existsSync(plugin.changelogPath) ? fs.readFileSync(plugin.changelogPath, 'utf8') : null;
  const notes = `- Rolled back to ${target}: the contents of \`${plugin.relDir}/\` are restored from \`${targetTag}\`.`;
  const updatedChangelog = addChangelogEntry(changelog, next, notes);

  console.log(`${name}: ${current} -> ${next} (contents of ${target})`);
  // plugin.json and CHANGELOG.md also change, but are not restored verbatim.
  console.log(git(['diff', '--stat', 'HEAD', targetTag, '--', plugin.relDir]) || '(no file differences)');
  if (flags['dry-run']) {
    console.log('\nDry run, nothing changed.');
    return;
  }

  // Tracked files that did not exist at the tag are removed as well.
  git(['restore', `--source=${targetTag}`, '--staged', '--worktree', '--', plugin.relDir]);

  setManifestVersion(plugin.manifestPath, next);
  fs.writeFileSync(plugin.changelogPath, updatedChangelog);
  git(['add', '--', plugin.relDir]);

  console.log(`
Staged the rollback in ${plugin.relDir}/. The marketplace.json entry is unchanged.

Next:
  1. Review: git diff --staged
  2. git commit -m "release(${name}): v${next}, roll back to ${target}" and open a pull request.
  3. After the merge, on main: node scripts/release.mjs tag ${name} --push`);
});
