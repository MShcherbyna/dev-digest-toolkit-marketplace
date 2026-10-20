# Dev Digest Toolkit

A plugin marketplace for [Claude Code](https://code.claude.com/docs/en/plugins/overview.md).

## Installation

In a Claude Code session:

```
/plugin marketplace add MShcherbyna/dev-digest-toolkit-marketplace
/plugin install <plugin>@dev-digest-toolkit
```

Or from a terminal:

```bash
claude plugin marketplace add MShcherbyna/dev-digest-toolkit-marketplace
claude plugin install <plugin>@dev-digest-toolkit
```

Auto-update is off by default for third-party marketplaces. To turn it on: `/plugin` → Marketplaces → `dev-digest-toolkit` → Enable auto-update. To update by hand: `/plugin marketplace update dev-digest-toolkit`, then `/reload-plugins`.

### For teams

To have the marketplace and plugins set up automatically in a project, commit this `.claude/settings.json` to it:

```json
{
  "extraKnownMarketplaces": {
    "dev-digest-toolkit": {
      "source": { "source": "github", "repo": "MShcherbyna/dev-digest-toolkit-marketplace" },
      "autoUpdate": true
    }
  },
  "enabledPlugins": {
    "<plugin>@dev-digest-toolkit": true
  }
}
```

The settings apply once a user trusts the project folder (workspace trust).

### Private access

Claude Code uses your existing git credentials; there is no token field. For HTTPS run `gh auth login && gh auth setup-git`. For SSH, keep your key in `ssh-agent` and `github.com` in `known_hosts`.

## Plugins

| Plugin | Description |
|---|---|
| _none yet_ | |

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) and the docs:

- [Plugin Guidelines](docs/PLUGIN-GUIDELINES.md)
- [Security](docs/SECURITY.md)
- [Releases](docs/RELEASES.md)

### GitHub repository settings

Settings → Rules → Rulesets → New branch ruleset for `main`:

1. **Require a pull request before merging**.
2. **Require status checks to pass** → add the `validate` check.
3. **Require review from Code Owners**: leave it off while one person maintains the repository, because GitHub does not let authors approve their own pull requests. Turn it on when other contributors join.

Also enable **Private vulnerability reporting** under Settings → Security.

## License

[MIT](LICENSE)
