# Releases

How plugin versions, tags, updates and rollbacks work. Based on [plugin loading](https://code.claude.com/docs/en/plugins/loading.md) and [hosting a marketplace](https://code.claude.com/docs/en/plugins/host-marketplace.md).

## How Claude Code sees versions

- Claude Code reads the version from `"version"` in `plugin.json`. In this marketplace it lives **only** there.
- Users get an update **only when the version string changes**. Pushing commits without a bump does nothing for them.
- A lower version is never treated as an update. Releases only move forward, including [rollbacks](#rollback).
- Every version is copied to its own cache directory (`~/.claude/plugins/cache/dev-digest-toolkit/<plugin>/<version>/`), so `${CLAUDE_PLUGIN_ROOT}` changes with each release.

## SemVer

| Change | Bump | Example |
|---|---|---|
| Removes or renames a skill, agent, command or hook; changes `userConfig` keys; changes behaviour users rely on | `major` | `1.4.2` → `2.0.0` |
| Adds a skill, agent, command, hook or option | `minor` | `1.4.2` → `1.5.0` |
| Fixes, wording, docs, internal refactoring | `patch` | `1.4.2` → `1.4.3` |

New plugins start at `0.1.0` while they are experimental and at `1.0.0` once they are stable.

## Release flow

Every change to `plugins/<name>/` must raise its version: CI fails a pull request whose plugin files changed while the version stayed the same or went down.

### 1. Bump on a feature branch

```bash
node scripts/release.mjs bump <plugin> <major|minor|patch|X.Y.Z> [--notes "text"] [--dry-run]
```

The script:

- raises `"version"` in `plugins/<plugin>/.claude-plugin/plugin.json`, touching nothing else in the file;
- adds a `## [<version>] - <date>` section to `plugins/<plugin>/CHANGELOG.md`, creating the file if needed;
- fills the section with `--notes`, or with the subjects of the commits that touched the plugin since its last tag.

Edit the changelog section if needed, then commit and open a pull request:

```bash
git add plugins/<plugin> && git commit -m "release(<plugin>): v<version>"
```

### 2. Tag on main after the merge

```bash
git checkout main && git pull
node scripts/release.mjs tag [<plugin>...] --push [--dry-run]
```

For every plugin (or the ones named), the script creates an annotated tag `<plugin>--v<version>` if that version is not tagged yet. The tag message is the changelog section. This is the same tag format as `claude plugin tag`. It is used by plugin dependency ranges and by the catalog site's "What's new" feed.

The script refuses to run on a branch other than `main`, on a dirty working tree, or when `main` is behind `origin/main`.

### 3. Users get the update

- With auto-update on, Claude Code picks the new version up in the background. It applies after `/reload-plugins` or a restart.
- Manually: `/plugin marketplace update dev-digest-toolkit`, then `/reload-plugins`.
- Auto-update is off by default for third-party marketplaces. Users turn it on in `/plugin` → Marketplaces, teams with `"autoUpdate": true` in `extraKnownMarketplaces`.

## Releasing plugins with dependencies

Some plugins depend on others through a version range in `plugin.json`:

```
sdd-engineering ──^1.0.0──► engineering-paved-path
                ──^1.0.0──► research-tools
                ──^1.0.0──► architecture-review ──^1.0.0──► engineering-paved-path
```

### How a range resolves

- At install time Claude Code looks for git tags `<plugin>--v<version>` in this repository and installs the highest one that satisfies the range. The `version` in `plugin.json` on `main` is not used for this.
- Without a matching tag the range resolves to nothing, and installing the dependent plugin fails. A plugin without dependencies installs without tags.
- So a dependency must be tagged before, or together with, every plugin that depends on it.

### Tag right after the merge

The merged `marketplace.json` lists the new plugins immediately. Until the tags are pushed, plugins with dependencies cannot be installed from GitHub. Tag as soon as the pull request is merged:

```bash
git checkout main && git pull
node scripts/release.mjs tag --dry-run   # lists the tags it would create
node scripts/release.mjs tag --push
git ls-remote --tags origin | grep -- '--v'   # check the tags reached GitHub
```

Without plugin names, `tag` creates the missing tags for every plugin and pushes them in one `git push`, so all of them appear at once and the order does not matter. Tags that already exist are skipped; running the command again is safe.

If you tag selected plugins (`release.mjs tag <plugin> --push`), each run pushes separately. Then tag in dependency order, leaves first:

1. `engineering-paved-path`, `research-tools`
2. `architecture-review`
3. `sdd-engineering`

Check the result from a clean profile: `claude plugin install sdd-engineering@dev-digest-toolkit` must install all four plugins.

### Changing a dependency

| Change in the dependency | What to do |
|---|---|
| `minor` or `patch`, e.g. `engineering-paved-path` 1.1.0 | Usual flow: bump, pull request, tag. `^1.0.0` picks 1.1.0 up; the dependent plugin does not change. |
| `major`, e.g. a skill or agent is renamed or removed | `^1.0.0` does not accept 2.0.0, so users of the dependent plugin stay on 1.x. In the same pull request bump the dependent plugin (`major`, since its range changes) to `^2.0.0`, then tag both. |
| `tag` prints `already exists, skipping` | The version was not bumped, so nothing is released. |

Dependents refer to skills and agents by namespaced name (`engineering-paved-path:zod`, `research-tools:researcher`), so renaming or removing one is a `major` change for the dependency.

## Rollback

Because a lower version is never an update, a rollback is a roll-forward: the old contents are released under a new, higher version.

```bash
git checkout -b rollback-<plugin>
node scripts/rollback.mjs <plugin> <target-version> [--version X.Y.Z] [--dry-run]
```

The script:

- restores `plugins/<plugin>/` from the tag `<plugin>--v<target-version>`, including removing files added after it;
- sets the version to the next patch above the highest known version (or `--version`);
- keeps the full `CHANGELOG.md` history and adds a section that records the rollback;
- stages the result without committing. It does not change the `marketplace.json` entry.

Then review, commit, open a pull request, and tag after the merge as in a normal release:

```bash
git diff --staged
git commit -m "release(<plugin>): v<version>, roll back to <target-version>"
# after the merge, on main:
node scripts/release.mjs tag <plugin> --push
```

If a release is harmful and users must not wait for the rollback PR, tell them to disable the plugin right away with `claude plugin disable <plugin>@dev-digest-toolkit`.

## Renaming or removing a plugin

- Rename: add the old name to `renames` in `marketplace.json` and keep it there. The map is append-only.
  ```json
  "renames": { "old-name": "new-name" }
  ```
- Remove: map the name to `null` in `renames`. Add `"forceRemoveDeletedPlugins": true` to uninstall it from users' machines.
- Prefer `displayName` over a rename when only the label changes.

## Known issues

These bugs were open in the Claude Code issue tracker in October 2026. Check whether they are still open before relying on the behaviour.

- [#93108](https://github.com/anthropics/claude-code/issues/93108): the update check compares version strings, not SemVer, so always write full `X.Y.Z` versions.
- [#95175](https://github.com/anthropics/claude-code/issues/95175): auto-update sometimes does not fire.
- [#90420](https://github.com/anthropics/claude-code/issues/90420): private git marketplaces may not refresh the cache.

Workaround for users: `claude plugin uninstall <plugin>@dev-digest-toolkit`, then install again.
