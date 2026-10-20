# Changelog

All notable changes to this plugin are documented here. Versions follow [SemVer](https://semver.org).

## [1.0.2] - 2026-10-20

- README: how to turn on auto-update and update by hand.

## [1.0.1] - 2026-10-20

- The plugin description now lists the `design` skill.

## [1.0.0] - 2026-10-20

- First release: a project-agnostic port of a production Spec Driven Development setup (see "Origin" in the README).
- Agents: `spec-creator`, `implementation-planner`, `implementer`, `check-runner`, `plan-verifier`.
- Skills: `run-plan` (implement → checks → architecture review ∥ plan audit → fix loop), `workflow-retro` (post-mortem of a run), `design` (visual source of truth for UI work).
- Project paths, modules and check commands come from `.claude/sdd-engineering.json`; nothing is hard-coded.
- Guards moved from agent frontmatter to `hooks/hooks.json` (plugin agents ignore the `hooks` field): `write-guard.mjs` and `readonly-bash-guard.mjs` act only on this plugin's agents.
- Depends on `engineering-paved-path`, `research-tools` and `architecture-review` (`^1.0.0`).
