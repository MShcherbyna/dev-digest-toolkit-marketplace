# Marketplace Research

> Temporary document. Delete it once the first plugin is created. Section 7 (the checklist) is already covered by `docs/PLUGIN-GUIDELINES.md`, `docs/SECURITY.md`, `docs/RELEASES.md` and the PR template.
>
> Collected 2026-10-20. Labels: **[V]** verified in a source (official docs, Anthropic repositories, issues), **[I]** our inference or recommendation.

## 0. Sources

- Official Claude Code docs (plugins section):
  - https://code.claude.com/docs/en/plugins/create-marketplace.md: build and test a marketplace
  - https://code.claude.com/docs/en/plugins/marketplace-reference.md: `marketplace.json` fields, source types, reserved names, strict mode
  - https://code.claude.com/docs/en/plugins/manifest-reference.md: `plugin.json` fields, layout, variables, `userConfig`
  - https://code.claude.com/docs/en/plugins/host-marketplace.md: hosting, private repos, updates, renames, channels
  - https://code.claude.com/docs/en/plugins/loading.md: cache, versions, auto-update
  - https://code.claude.com/docs/en/plugins/cli-reference.md: every `claude plugin` command
  - https://code.claude.com/docs/en/plugins/org.md: managed settings, `extraKnownMarketplaces`, `enabledPlugins`
  - Not read, but they exist: `plugins/security.md`, `plugins/troubleshooting.md`, `plugins/dependencies.md` (index: https://code.claude.com/docs/llms.txt)
- Anthropic repositories:
  - https://github.com/anthropics/claude-plugins-official (`plugins/` + `external_plugins/`, CI in `.github/workflows`)
  - https://github.com/anthropics/claude-plugins-community (composite action `validate-plugins`)
  - https://github.com/anthropics/skills (skills-only bundles)
- Directory pre-submission checklist: https://claude.com/docs/plugins/pre-submission-checklist
- Skills best practices: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Community: wshobson/agents, obra (examples of large marketplaces). Reddit and HN had nothing useful; the most valuable signal is the anthropics/claude-code issue tracker.

## 1. Repository layout

```
<marketplace-root>/
├── .claude-plugin/
│   └── marketplace.json          # the catalog
├── plugins/
│   └── <plugin-name>/
│       ├── .claude-plugin/
│       │   └── plugin.json       # the only file in .claude-plugin/
│       ├── skills/<skill>/SKILL.md
│       ├── agents/*.md
│       ├── commands/*.md         # prefer skills for new plugins
│       ├── hooks/hooks.json
│       ├── .mcp.json
│       ├── .lsp.json
│       ├── scripts/
│       └── README.md
├── README.md
└── LICENSE
```

- **[V]** The marketplace root is the directory that contains `.claude-plugin/`. Relative `source` paths resolve from the root, not from `.claude-plugin/`.
- **[V]** All plugin components (skills, commands, agents, hooks, `.mcp.json`, `.lsp.json`) live at the plugin root, not in `.claude-plugin/`.
- **[V]** `CLAUDE.md` at the plugin root is **not loaded** (validate warns). Put instructions in a skill.
- **[V]** A top-level `bin/` is added to the Bash tool PATH, but claude.ai / Cowork org sync rejects such plugins. Put scripts in `scripts/`.
- **[V]** A plugin with `SKILL.md` at its root and no `skills/` loads as a single skill.
- **[V]** `metadata.pluginRoot: "./plugins"` lets entries use a bare name instead of `./plugins/<name>` (v2.1.239+).
- **[V]** claude-plugins-official splits plugins into `plugins/` (its own) and `external_plugins/` (partners).

## 2. `marketplace.json`

Required: `name`, `owner` (with `owner.name`; `email` and `url` are optional), `plugins` (array).

Optional: `$schema` (ignored at load time), `description` (validate warns without it), `version`, `metadata` (`description`, `version`, `pluginRoot`), `forceRemoveDeletedPlugins`, `allowCrossMarketplaceDependenciesOn`, `renames`.

- **[V]** Marketplace `name`: letters, digits, `.`, `_`, `-`; starts with a letter or digit; no `..`. The name comes from the JSON, not from the repository name.
- **[V]** Unknown keys are silently ignored at load time (a typo raises no error); validate reports them as warnings.
- **[V]** `$schema`: anthropics/claude-code uses `https://json.schemastore.org/claude-code-marketplace.json`.

Minimal example:

```json
{
  "name": "my-marketplace",
  "description": "Plugins for my team",
  "owner": { "name": "Your Name" },
  "plugins": [
    { "name": "my-first-plugin", "source": "./plugins/my-first-plugin", "description": "..." }
  ]
}
```

### Plugin entry

- **[V]** Required: `name`, `source`. Optional: `description`, `version`, `category`, `tags`, `strict` (default `true`), `dependencies`, `defaultEnabled`, `displayName`, `metadata`, `relevance`, `headers`, `headersHelper`. An entry also accepts any `plugin.json` field, subject to strict mode.
- **[V]** The entry `name` is the install id (`<name>@<marketplace>`); the `plugin.json` `name` is the skill namespace. They **must match**, otherwise `Plugin "<x>" not found in marketplace`.

### Source types

| Type | Example |
|---|---|
| relative path | `"./plugins/formatter"`: must start with `./`, `..` is rejected |
| `github` | `{ "source": "github", "repo": "owner/repo", "ref": "...", "sha": "<40 hex>" }` |
| `url` | `{ "source": "url", "url": "https://...git" }`: any git repository |
| `git-subdir` | `{ "source": "git-subdir", "url": "owner/repo", "path": "tools/x" }`: sparse checkout |
| `npm` | `{ "source": "npm", "package": "@scope/name", "version": "..." }`: install scripts do not run |
| `archive` | `{ "source": "archive", "url": "https://...zip", "sha256": "..." }`: https only, 256 MiB limit |
| `command` | `{ "source": "command", "command": "..." }`: the user must accept the command |

- **[V]** When both `ref` and `sha` are set, `sha` wins. A full 40-character SHA pins the commit.

### Strict mode

- **[V]** No `plugin.json`: the catalog entry is the manifest.
- **[V]** `plugin.json` present, `strict: true` (default): `plugin.json` is authoritative; entry `commands/agents/skills` are appended, entry `hooks` replace the manifest hooks per event.
- **[V]** `plugin.json` present, `strict: false`, and the entry declares components: error `conflicting manifests`.
- **[V]** Entry `mcpServers`, `lspServers`, `userConfig`, `channels` are ignored when `plugin.json` exists.
- **[V]** Entry `hooks` must be an inline object; a file path there never runs.

## 3. `plugin.json` and the plugin

- **[V]** Only `name` is required (kebab-case; no spaces, `@`, `:`, slashes).
- **[V]** Recommended: `version`, `description`, `author` (`name` + `email`/`url`), `homepage` (**must be a valid URL, or the plugin fails to load**), `repository`, `license` (SPDX), `keywords`.
- **[V]** How component keys behave:
  - `commands`, `agents`, `outputStyles`, `workflows` **replace** the default directory scan;
  - `skills` **adds** to the `skills/` scan;
  - `hooks`, `mcpServers`, `lspServers` **merge** with the files.
- **[V]** All paths are relative to the plugin root, start with `./`, use forward slashes, and stay inside the plugin.
- **[V]** `hooks/hooks.json` is wrapped in `{"hooks": {...}}`; inline hooks are not. Do not list `hooks/hooks.json` in `plugin.json`: it loads automatically.
- **[V]** Skills-only bundles (anthropics/skills): `"source": "./"`, `"strict": false`, an explicit `skills` array, no `plugin.json`.

### Variables

- **[V]** `${CLAUDE_PLUGIN_ROOT}`: path to the installed version; **changes on update**, do not keep state there.
- **[V]** `${CLAUDE_PLUGIN_DATA}`: `~/.claude/plugins/data/<id>/`, survives updates. For `node_modules`, caches, generated files.
- **[V]** `${CLAUDE_PROJECT_DIR}`, `${user_config.KEY}` / `CLAUDE_PLUGIN_OPTION_<KEY>` (in hooks).
- **[V]** Substituted in hooks, MCP/LSP command/args/env, and skill/command/agent bodies. **Not available** in the Bash tool environment.

### `userConfig`

- **[V]** Options with `type` (string|number|boolean|directory|file), `title`, `description`; optional `required`, `default`, `sensitive` (stored in the keychain), `min`, `max`.
- **[V]** `${user_config.*}` is rejected in shell-form hooks; read `CLAUDE_PLUGIN_OPTION_<KEY>` there.

## 4. Versions, cache, updates

- **[V]** Version resolution: `plugin.json` `version` → the catalog entry `version` → the commit SHA (12 characters) for git sources.
- **[V]** With `version` set, users get updates **only when the string changes**. Push without a bump → `already at the latest version`.
- **[V]** With no `version` anywhere, the SHA is the version and every commit counts as an update.
- **[V]** `version` in both places → `plugin.json` silently wins, validate warns.
- **[V]** Cache: `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`. Old versions are deleted 14 days after being marked orphaned.
- **[V]** Files outside the plugin directory (`../shared`) are **not copied** to the cache. Symlinks: kept if inside the plugin, dereferenced if they point elsewhere in the marketplace, skipped if they point outside. Git LFS files arrive as pointers. Marketplace clones recurse into submodules (#100214).
- **[V]** A local marketplace (`marketplace add ./dir`) and `--plugin-dir` load plugins in place: no bump needed during development, `/reload-plugins` is enough.
- **[V]** Auto-update is **off by default** for third-party marketplaces, and `marketplace.json` has no field for it. Users turn it on in `/plugin` → Marketplaces, admins with `autoUpdate: true` in `extraKnownMarketplaces`. It applies after `/reload-plugins` or a restart.
- **[V]** Release channels: two marketplaces with different `name`s on different refs, or `owner/repo#stable`.
- **[V]** `claude plugin tag` creates `<name>--v<version>` tags, needed for semver dependencies between plugins.
- **[V]** Renames: `renames` (append-only; `null` = removed) + `forceRemoveDeletedPlugins: true`. For a new display name use `displayName`.
- **[I]** Our strategy: SemVer only in `plugin.json`; CI requires a bump (a greater SemVer) when `plugins/<name>/**` changes.

### Known bugs (check they are still open before relying on them)

- #93108: versions compared as strings, not SemVer (`1.0` ≠ `1.0.0`), possible downgrade, an existing version directory reused without re-copying.
- #90420: private git marketplaces do not refresh the cache.
- #95175, #89243, #17361: autoUpdate does not fire.
- #75046, #79776: versionless plugins are reported as updated on every refresh.
- #98154: the version is taken from a parent git repo when `~/.claude` is itself a git repo.
- #94762: inline `skills` with `strict:false` are not registered on some versions.
- #95430: new skills in an already enabled plugin are not visible until reload.
- #102149: skills show up twice when both `cache/` and `marketplaces/` are scanned.
- User workaround: uninstall, then install.

## 5. Installation, commands, teams

```
/plugin marketplace add <owner>/<repo>          # or owner/repo#ref, a git URL, ./local-dir
/plugin install <plugin>@<marketplace-name>
/plugin marketplace update <name>
/reload-plugins
```

CLI: `claude plugin marketplace add|list|update|remove`, `claude plugin install|uninstall|enable|disable|update|list|details`, `claude plugin validate <path> [--strict] [--json]`, `claude plugin tag`, `claude --plugin-dir ./plugins/x` (session-only loading).

Scopes: `user` (`~/.claude/settings.json`), `project` (`.claude/settings.json`, committed), `local` (`.claude/settings.local.json`).

Team setup, in the project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "<marketplace-name>": {
      "source": { "source": "github", "repo": "<owner>/<repo>" },
      "autoUpdate": true
    }
  },
  "enabledPlugins": { "<plugin>@<marketplace-name>": true }
}
```

- **[V]** The key in `extraKnownMarketplaces` must equal `name` in `marketplace.json`.
- **[V]** Applies only after workspace trust is accepted; untrusted folders silently ignore it.
- **[V]** Shortcut: `claude plugin marketplace add <owner>/<repo> --scope project`.
- **[V]** Managed settings: `strictKnownMarketplaces` (allowlist), `blockedMarketplaces`. An empty allowlist `[]` blocks everything, including the official marketplace.

### Private repositories

- **[V]** There is no token field, neither in Claude Code nor in `marketplace.json`. Git runs non-interactively with existing credentials.
- **[V]** SSH: key in ssh-agent without a passphrase, host in `known_hosts`. HTTPS: `gh auth login && gh auth setup-git`.
- **[V]** For `owner/repo` SSH is probed first, then HTTPS. `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` skips the probe.
- **[V]** `GITHUB_TOKEN` / `GH_TOKEN` in the environment does not authenticate background updates without a credential helper.
- **[V]** `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1` keeps the existing checkout when the background check cannot authenticate.
- **[V]** A marketplace added by a direct `marketplace.json` URL cannot use relative `source` entries.

## 6. Best practices

### Names

- **[V]** kebab-case; Anthropic CI uses `^[a-z0-9][a-z0-9-]{1,63}$` and rejects hidden Unicode.
- **[V]** Rejected plugin names: prefixes `claude-`, `anthropic-`, `anthropics-`, `cc-plugin-`; exactly `claude`, `anthropic`, `anthropics`, `claude-code`, `claude-mods`.
- **[V]** Reserved marketplace names: `claude-code-marketplace`, `claude-code-plugins`, `claude-plugins-official`, `anthropic-marketplace`, `anthropic-plugins`, `agent-skills`, `anthropic-agent-skills`, `claude-community`, `claude-plugins-community`, `inline`, `builtin`, `skills-dir`, `npm`, `pip`, `github`, `gh`, `claudeai-*`, impersonations of official names, any non-ASCII name, and more. Validate does **not** catch these: `marketplace add` refuses them.
- **[V]** Names are effectively permanent.

### Skills

- **[V]** `name` ≤ 64 characters, lowercase/digits/hyphens, no "claude" / "anthropic".
- **[V]** `description` ≤ 1024 characters, a single string (not a list), third person: what it does + "Use when..." with trigger words.
- **[V]** `SKILL.md` body < 500 lines; reference files one level deep; long files with a table of contents; forward slashes; fully qualified MCP tool names; test on Haiku/Sonnet/Opus; evals first (`claude plugin eval`).
- **[I]** Small, focused plugins: less context, selective installs.
- **[I]** Portable `SKILL.md` (Markdown + YAML frontmatter) for compatibility with other agents.

### Hooks and scripts

- **[V]** Quote variables: `"\"${CLAUDE_PLUGIN_ROOT}\"/scripts/x.sh"` or exec form with `args` (#78490: paths with spaces).
- **[V]** Explicit interpreter: `bash "${CLAUDE_PLUGIN_ROOT}/scripts/x.sh"`. On Windows a bare `.sh` goes through git-bash without stdio and silently does nothing (#95673).
- **[V]** A hook without the executable bit fails open: guard hooks silently stop guarding (#94362, #38686). Also commit with `git update-index --chmod=+x`.
- **[V]** Node dependencies are installed into the cache only with `package.json` + `package-lock.json` (v2/v3) or a text `bun.lock`; `--ignore-scripts`, 60 s limit; `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb` are skipped.
- **[I]** `.gitattributes` with `*.sh text eol=lf`, without `filter` and `export-ignore`.

### Documentation

- **[V]** Plugin README ≥ 40 words (code blocks excluded), `LICENSE` or `license` in `plugin.json`, `description`/`author`/`version`.
- **[V]** Cleanliness: no `.DS_Store`, `Thumbs.db`, `__MACOSX`; Windows-safe names (no case collisions, no `con.md`); non-image files < 256 KiB; ≤ 512 files; no symlinks, submodules or LFS in loaded files.
- **[I]** Root README listing plugins and install commands, root LICENSE, CONTRIBUTING. CHANGELOG per plugin or GitHub releases on `<name>--v<version>` tags.

### Security

- **[V]** Plugins run with the user's privileges; Anthropic does not control third-party plugin contents.
- **[V]** No secrets in the repository: `userConfig` with `sensitive: true` + `${user_config.KEY}`.
- **[V]** Exact versions for `npx`/`uvx` (no `@latest`); no `.npmrc` or custom registries.
- **[V]** Never read the user's `$GITHUB_TOKEN` or send it anywhere.
- **[V]** Remote MCP over https/wss only; local MCP as `node ${CLAUDE_PLUGIN_ROOT}/server.js` without a shell or `-c`.
- **[V]** Readable, non-minified code; the README discloses everything the plugin runs and sends.
- **[V]** Project-scope plugins load only after workspace trust; MCP servers need separate approval.
- **[I]** Secret scanning (gitleaks), SHA-pinned external `source` entries.

### CI

- **[V]** `claude plugin validate .` (marketplace + every relative `plugin.json`); `--strict` turns warnings into errors. Exit: 0 ok, 1 fail, 2 validator crash.
- **[V]** Validate does **not** catch: missing `source` directories (`Source path does not exist` only at install), remote source errors, reserved marketplace names, hook files in entries. A real `marketplace add` + `install` is needed.
- **[V]** Ready-made composite action: `anthropics/claude-plugins-community/.github/actions/validate-plugins@<SHA>` (invariants + validate + parsing `.mcp.json`/`.lsp.json`/`hooks.json`). Pin both the action SHA and the CLI version.
- **[V]** claude-plugins-official also checks SKILL.md/agents/commands frontmatter, licenses, MCP URLs, and runs a Claude-based security scan.
- **[V]** Pitfall: `paths: */skills/**` does not match `plugins/<x>/skills/**` (`*` does not cross `/`), so a required check hangs at "Expected". Use `plugins/**` or no filter.

## 7. Checklist for this repository

> Now covered by the permanent docs and the PR template; kept here until this file is deleted.

### Structure

- [x] `.claude-plugin/marketplace.json` with `name`, `owner.name`, `description`, `plugins`
- [x] The marketplace name is not reserved (`marketplace add ./` succeeds)
- [ ] Every plugin in `plugins/<name>/`, `source` starts with `./`, no `..`, the directory exists
- [ ] Every plugin has `.claude-plugin/plugin.json`; `name` matches the catalog entry
- [ ] `plugin.json`: `version` (SemVer), `description`, `author`, `license`; `homepage` is a valid URL
- [ ] `version` **only** in `plugin.json`, not in the catalog entry
- [ ] No `CLAUDE.md` at the plugin root, no top-level `bin/`
- [ ] No symlinks pointing outside, no LFS, no submodules, no `.DS_Store`
- [ ] Plugin README ≥ 40 words

### Governance

- [x] A change to `plugins/<name>/**` requires a greater version in `plugin.json` than on the base branch
- [x] CODEOWNERS covers every plugin
- [ ] Required status check on `main` (GitHub UI)
- [ ] Dependencies pinned, no `@latest`
- [x] No secrets or absolute paths (linter + gitleaks)

### Validation

- [x] `node scripts/validate-marketplace.mjs` → exit 0
- [x] `claude plugin validate .` → passes (with `--strict` it fails on an empty catalog, so CI uses `--strict` per plugin)
- [x] Negative test: an entry with a missing directory → the linter fails
- [x] `claude plugin marketplace add ./` + `claude plugin install <name>@<marketplace>` work
- [ ] `claude --plugin-dir ./plugins/<name>` loads components without warnings (first plugin)
- [x] Hooks: quoted variables, explicit interpreter, `+x` (linter checks)
