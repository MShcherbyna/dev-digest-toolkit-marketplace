# Plugin Guidelines

How a plugin in this marketplace is structured. Based on the official Claude Code docs: [create a marketplace](https://code.claude.com/docs/en/plugins/create-marketplace.md), [marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference.md), [manifest reference](https://code.claude.com/docs/en/plugins/manifest-reference.md).

Most rules below are enforced by `scripts/validate-marketplace.mjs` and `claude plugin validate` in CI.

## 1. Layout

```
plugins/<name>/
├── .claude-plugin/
│   └── plugin.json       # the only file inside .claude-plugin/
├── skills/<skill>/SKILL.md
├── agents/*.md
├── commands/*.md         # prefer skills for new plugins
├── hooks/hooks.json
├── .mcp.json
├── scripts/
├── CHANGELOG.md
└── README.md
```

- All components (`skills/`, `agents/`, `hooks/`, `.mcp.json`, ...) live at the plugin root, never inside `.claude-plugin/`.
- `CLAUDE.md` at the plugin root is **not loaded** by Claude Code. Put instructions in a skill.
- No top-level `bin/`: claude.ai org sync rejects plugins that have one. Put executables in `scripts/`.
- A plugin is self-contained. Installed plugins are copied to `~/.claude/plugins/cache/`, and files outside the plugin directory (`../shared`) are not copied. No symlinks pointing outside the plugin, no Git LFS, no submodules.
- Keep plugins small and focused: users install only what they need, and less context is spent.

## 2. Naming

- `name` is kebab-case: `^[a-z0-9][a-z0-9-]{1,63}$`.
- Reserved and rejected: names starting with `claude-`, `anthropic-`, `anthropics-`, `cc-plugin-`, and the names `claude`, `anthropic`, `anthropics`, `claude-code`, `claude-mods`.
- The name is the install id (`<name>@dev-digest-toolkit`) and the skill namespace, so treat it as permanent. Use `displayName` for a different label. A rename needs a `renames` entry in `marketplace.json`, see [RELEASES.md](RELEASES.md#renaming-or-removing-a-plugin).

## 3. Catalog entry

Add the plugin to `.claude-plugin/marketplace.json`, keeping entries sorted by `name`:

```json
{
  "name": "my-plugin",
  "source": "./plugins/my-plugin",
  "description": "One sentence about what the plugin does.",
  "category": "productivity",
  "tags": ["git", "review"]
}
```

- `name` must equal `name` in `plugin.json`, otherwise installs fail with `Plugin "<x>" not found`.
- `source` starts with `./`, never contains `..`, and points to an existing directory.
- **No `version` in the entry.** The version lives only in `plugin.json`; when both are set, `plugin.json` silently wins.
- Component fields (`skills`, `hooks`, `mcpServers`, ...) belong in `plugin.json`, not in the entry.

## 4. Manifest (`plugin.json`)

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "One sentence about what the plugin does.",
  "author": { "name": "Maksym Shcherbyna", "url": "https://github.com/MShcherbyna" },
  "license": "MIT",
  "homepage": "https://github.com/MShcherbyna/dev-digest-toolkit-marketplace/tree/main/plugins/my-plugin",
  "repository": "https://github.com/MShcherbyna/dev-digest-toolkit-marketplace",
  "keywords": ["git", "review"]
}
```

- Required here: `name`, `version` (SemVer), `description`, `author.name`, `license` (SPDX id).
- `homepage`, if set, must be a valid URL: an invalid one stops the plugin from loading.
- `keywords`: search terms in English **and** Ukrainian, e.g. `["review", "pull-request", "рев'ю"]`. The [catalog site](../site/README.md) matches Ukrainian queries through them, since descriptions are in English; skills and agents inherit their plugin's keywords. The linter warns when `keywords` is missing.
- Component keys behave differently. `commands`, `agents`, `outputStyles` **replace** the default directory scan. `skills` **adds** to it. `hooks`, `mcpServers`, `lspServers` **merge** with the files.
- Component paths are relative to the plugin root, start with `./`, and use forward slashes.
- Do not list `hooks/hooks.json` in `hooks`: it loads automatically.

## 5. Skills

```markdown
---
name: review-pr
description: Reviews a pull request for correctness and style. Use when the user asks to review a PR, a diff or a branch.
---
```

- `name`: at most 64 characters, lowercase letters, digits and hyphens, no "claude" or "anthropic".
- `description`: at most 1024 characters, a single string (not a list), third person. Say what the skill does and when to use it ("Use when..."), with the words users would actually type.
- Keep the `SKILL.md` body under 500 lines. Move reference material into separate files one level deep, and give long files a table of contents.
- Keep skills portable (plain Markdown + YAML frontmatter) so other agents can use them.
- Test skills with [`claude plugin eval`](https://code.claude.com/docs/en/plugins/overview.md) before relying on them.

## 6. Hooks and scripts

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "bash \"${CLAUDE_PLUGIN_ROOT}/scripts/check.sh\"" }]
      }
    ]
  }
}
```

- `hooks/hooks.json` is wrapped in a top-level `"hooks"` object.
- Always quote `${CLAUDE_PLUGIN_ROOT}`: paths with spaces break otherwise.
- Call scripts through an explicit interpreter (`bash`, `node`, `python3`). On Windows a bare `.sh` path silently does nothing.
- Commit scripts with the executable bit: `git update-index --chmod=+x scripts/check.sh`. A hook that cannot run fails open, so a guard hook silently stops guarding.
- `${CLAUDE_PLUGIN_ROOT}` changes with every version. Store state, caches and generated files in `${CLAUDE_PLUGIN_DATA}`, which survives updates.
- `${CLAUDE_PLUGIN_ROOT}` is not set in the Bash tool environment. In skill and agent Markdown it is substituted inline.

## 7. Dependency requirements

### Runtime dependencies

- Node dependencies are installed into the cache only when the plugin has `package.json` **and** `package-lock.json` (v2/v3) or a text `bun.lock`. `yarn.lock`, `pnpm-lock.yaml` and binary `bun.lockb` are ignored.
- The install runs with `--ignore-scripts`, from the registry only, within 60 seconds. Do not depend on `postinstall`.
- Pin exact versions. `npx` and `uvx` launchers name an exact version, never `@latest`.
- No `.npmrc` and no custom registries.
- Prefer node built-ins and the standard library. Every dependency is code that runs on the user's machine.

### Plugin dependencies

- A plugin can require other plugins through `dependencies` in `plugin.json`: `"other-plugin"` (same marketplace) or `"other-plugin@other-marketplace"`.
- Cross-marketplace dependencies need the other marketplace in `allowCrossMarketplaceDependenciesOn` in `marketplace.json`.
- Semver ranges on dependencies resolve against `<name>--v<version>` tags, which `scripts/release.mjs tag` creates.

### External sources

- A plugin hosted in another repository uses a `github`, `url` or `git-subdir` source pinned with a full 40-character `sha`.

## 8. Documentation

- `README.md` in every plugin: what it does, every component it adds, configuration, what it runs and where it sends data, and the install line:
  ```
  /plugin install <name>@dev-digest-toolkit
  ```
- `CHANGELOG.md`, maintained by `scripts/release.mjs bump`. See [RELEASES.md](RELEASES.md).
- Add the plugin to the table in the root `README.md`.

## 9. Local testing

```bash
claude --plugin-dir ./plugins/<name>          # load for one session, no install
claude plugin validate plugins/<name> --strict

claude plugin marketplace add ./              # full install from the local marketplace
claude plugin install <name>@dev-digest-toolkit
claude plugin details <name>
```

Plugins from a local-path marketplace load in place, so during development there is no need to bump the version: `/reload-plugins` is enough.
