# Changelog

All notable changes to this plugin are documented here. Versions follow [SemVer](https://semver.org).

## [1.0.0] - 2026-10-20

- First release: the generalized `architecture-reviewer` agent. Rules come from the project's architecture document and the `engineering-paved-path` skills instead of being hard-coded for one repository.
- Read-only git guard for the agent's Bash calls, wired in `hooks/hooks.json` (plugin agents ignore the `hooks` frontmatter field).
- Depends on `engineering-paved-path` `^1.0.0`.
