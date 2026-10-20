# PR Review

Reviews pull requests in Claude Code. See the [checklist](docs/checklist.md) and the [Claude Code docs](https://code.claude.com/docs).

![diagram](docs/diagram.png)

<script>alert('xss')</script>

## What it runs

- A `PreToolUse` hook that blocks `git push --force`.
- A local MCP server for GitHub metadata.

| Component | Purpose |
|---|---|
| review-diff | Reviews the current diff |
| reviewer | Agent for deep reviews |
