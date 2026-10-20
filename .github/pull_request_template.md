## What changed

<!-- Which plugin, what was added or fixed. -->

## Checklist

### Structure ([Plugin Guidelines](../docs/PLUGIN-GUIDELINES.md))
- [ ] The plugin lives in `plugins/<name>/`; the `marketplace.json` entry is sorted by `name`
- [ ] The entry `name` equals `name` in `plugin.json`; kebab-case, no `claude-` / `anthropic-` prefix
- [ ] `plugin.json` has `version` (SemVer), `description`, `author`, `license`
- [ ] `version` is **only** in `plugin.json`, not in `marketplace.json`
- [ ] `README.md` describes the plugin and has the install line
- [ ] No `CLAUDE.md` at the plugin root, no `bin/`, no symlinks pointing outside, no `.DS_Store`
- [ ] Dependencies are pinned, with a lockfile when there is a `package.json`

### Security ([Security](../docs/SECURITY.md))
- [ ] No secrets, tokens or absolute paths; sensitive values go through `userConfig` with `sensitive: true`
- [ ] `npx` / `uvx` pin an exact version, no `@latest`
- [ ] Remote MCP servers use https/wss only
- [ ] The README states what the plugin runs and where it sends data

### Hooks and scripts (if any)
- [ ] `${CLAUDE_PLUGIN_ROOT}` is quoted and scripts run through an explicit interpreter (`bash "..."`, `node ...`)
- [ ] Scripts have the executable bit (`git update-index --chmod=+x`)
- [ ] State is stored in `${CLAUDE_PLUGIN_DATA}`, not in `${CLAUDE_PLUGIN_ROOT}`

### Release ([Releases](../docs/RELEASES.md))
- [ ] The version was bumped with `node scripts/release.mjs bump` and `CHANGELOG.md` describes the change
- [ ] Checked locally: `node scripts/validate-marketplace.mjs` and `claude plugin validate plugins/<name> --strict`
- [ ] Checked by hand: `claude --plugin-dir ./plugins/<name>` loads the components without warnings
