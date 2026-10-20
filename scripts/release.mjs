#!/usr/bin/env node
// Plugin releases in two steps, see docs/RELEASES.md.
//
//   node scripts/release.mjs bump <plugin> <major|minor|patch|X.Y.Z> [--notes "text"] [--dry-run]
//     On a feature branch: raises "version" in plugin.json and adds a CHANGELOG.md section.
//     Notes default to the commit subjects that touched the plugin since its last tag.
//
//   node scripts/release.mjs tag [<plugin>...] [--push] [--remote origin] [--dry-run]
//     On a clean main after the merge: creates an annotated <plugin>--v<version> tag for
//     every plugin whose current version is not tagged yet. --push sends the tags.
//     CI runs `tag --push` on every merge to main (.github/workflows/pages.yml).

import fs from 'node:fs';
import {
  addChangelogEntry, bumpVersion, changelogSection, compareSemver, currentBranch, fail, git,
  gitOk, isClean, listPlugins, loadPlugin, parseFlags, run, setManifestVersion, tagName, taggedVersions,
} from './lib/release-utils.mjs';

const USAGE = `usage:
  node scripts/release.mjs bump <plugin> <major|minor|patch|X.Y.Z> [--notes "text"] [--dry-run]
  node scripts/release.mjs tag [<plugin>...] [--push] [--remote origin] [--dry-run]`;

function bump(argv) {
  const { flags, positional } = parseFlags(argv, { notes: 'string', 'dry-run': 'boolean' });
  const [name, kind] = positional;
  if (!name || !kind || positional.length > 2) fail(USAGE);

  const plugin = loadPlugin(name);
  const current = plugin.manifest.version;
  const next = bumpVersion(current, kind);
  if (compareSemver(next, current) <= 0) fail(`new version ${next} must be greater than ${current}`);
  const [lastTagged] = taggedVersions(name);
  if (lastTagged && compareSemver(next, lastTagged) <= 0) fail(`new version ${next} must be greater than the last release ${lastTagged}`);

  let notes = flags.notes?.trim();
  if (!notes) {
    const range = lastTagged ? [`${tagName(name, lastTagged)}..HEAD`] : [];
    const subjects = git(['log', '--no-merges', '--format=%s', ...range, '--', plugin.relDir]).split('\n').filter(Boolean);
    notes = subjects.length ? subjects.map((s) => `- ${s}`).join('\n') : '- TODO: describe the changes';
  } else if (!notes.startsWith('-')) {
    notes = `- ${notes}`;
  }

  const changelog = fs.existsSync(plugin.changelogPath) ? fs.readFileSync(plugin.changelogPath, 'utf8') : null;
  const updated = addChangelogEntry(changelog, next, notes);

  console.log(`${name}: ${current} -> ${next}`);
  console.log(`\nCHANGELOG.md section:\n${notes}\n`);
  if (flags['dry-run']) {
    console.log('Dry run, nothing written.');
    return;
  }

  setManifestVersion(plugin.manifestPath, next);
  fs.writeFileSync(plugin.changelogPath, updated);

  if (currentBranch() === 'main') console.log('warning: you are on main; releases go through a pull request');
  console.log(`Updated ${plugin.relDir}/.claude-plugin/plugin.json and ${plugin.relDir}/CHANGELOG.md.

Next:
  1. Edit the CHANGELOG.md section if needed.
  2. git add ${plugin.relDir} && git commit -m "release(${name}): v${next}", then open a pull request.
  3. After the merge, CI tags ${tagName(name, next)} and redeploys the catalog site.`);
}

function tag(argv) {
  const { flags, positional } = parseFlags(argv, { push: 'boolean', remote: 'string', 'dry-run': 'boolean' });
  const remote = flags.remote ?? 'origin';
  const dryRun = flags['dry-run'];

  if (currentBranch() !== 'main') fail('tags are created on main after the release pull request is merged');
  if (!isClean()) fail('working tree is not clean');
  if (flags.push && gitOk(['remote', 'get-url', remote])) {
    git(['fetch', '--quiet', '--tags', remote]);
    const behind = git(['rev-list', '--count', `HEAD..${remote}/main`]);
    if (behind !== '0') fail(`main is ${behind} commit(s) behind ${remote}/main; pull first`);
  }

  const names = positional.length ? positional : listPlugins();
  const created = [];
  for (const name of names) {
    const plugin = loadPlugin(name);
    const { version } = plugin.manifest;
    const tagged = taggedVersions(name);
    const t = tagName(name, version);

    if (tagged.includes(version)) {
      console.log(`${name}: ${t} already exists, skipping`);
      continue;
    }
    if (tagged[0] && compareSemver(version, tagged[0]) < 0) {
      fail(`${name}: version ${version} is lower than the last release ${tagged[0]}`);
    }

    const changelog = fs.existsSync(plugin.changelogPath) ? fs.readFileSync(plugin.changelogPath, 'utf8') : '';
    const notes = changelogSection(changelog, version);
    if (!notes) console.log(`warning: ${name}: CHANGELOG.md has no section for ${version}`);
    const message = `${name} v${version}${notes ? `\n\n${notes}` : ''}\n`;

    if (dryRun) console.log(`${name}: would create ${t}`);
    else {
      git(['tag', '-a', t, '-F', '-'], { input: message });
      console.log(`${name}: created ${t}`);
    }
    created.push(t);
  }

  if (!created.length) {
    console.log('Nothing to tag.');
    return;
  }
  if (flags.push && !dryRun) {
    git(['push', remote, ...created.map((t) => `refs/tags/${t}`)]);
    console.log(`Pushed ${created.length} tag(s) to ${remote}.`);
  } else if (!dryRun) {
    console.log(`\nPush with: git push ${remote} ${created.join(' ')}`);
  }
}

run((argv) => {
  const [command, ...rest] = argv;
  if (command === 'bump') bump(rest);
  else if (command === 'tag') tag(rest);
  else fail(USAGE);
});
