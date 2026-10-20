# Contributing

Thanks for adding to the Dev Digest Toolkit marketplace. The rules live in three documents:

- [Plugin Guidelines](docs/PLUGIN-GUIDELINES.md): plugin structure, naming, manifest, skills, hooks, dependency requirements.
- [Security](docs/SECURITY.md): permissions, secrets policy, review of scripts and MCP servers.
- [Releases](docs/RELEASES.md): SemVer, tags, updates, rollback.

Principle: explore first, standardise later. Rules are added when real plugins need them.

## Workflow

1. Create a branch.
2. Add or change a plugin under `plugins/<name>/` following the [Plugin Guidelines](docs/PLUGIN-GUIDELINES.md).
3. Bump its version: `node scripts/release.mjs bump <name> <major|minor|patch>`.
4. Run the checks below and open a pull request. The template has the review checklist.
5. Merge. The **Deploy catalog site** workflow tags the release on `main` (`<name>--v<version>`) and redeploys the catalog.

## Checks

CI runs these on every pull request and every push to `main`:

```bash
node scripts/validate-marketplace.mjs --base origin/main   # structural linter and version-bump check
claude plugin validate .                                   # the marketplace
claude plugin validate plugins/<name> --strict             # every plugin
```

`gitleaks` also scans the history for secrets.

To try a plugin by hand:

```bash
claude --plugin-dir ./plugins/<name>
```

## Scripts

| Script | Purpose |
|---|---|
| `scripts/validate-marketplace.mjs` | Cross-file checks that `claude plugin validate` does not do |
| `scripts/release.mjs` | `bump` a plugin version and changelog; `tag` releases on `main` |
| `scripts/rollback.mjs` | Restore a plugin from an earlier release under a new version |

All scripts use node built-ins only and need Node 22 or later.
