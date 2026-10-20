# architecture-review

A read-only **architecture-reviewer** agent for Claude Code. After a change is implemented, it checks the changed code against architectural boundaries (backend layering, module isolation, frontend feature boundaries, the Next.js server-client component split, protected paths) and **your project's own architecture rules**. It returns findings with `file:line` evidence and quoted code, a verdict, and an honest "cannot verify" list.

It never edits files. Its verdict is advisory: your CI, PR checklist or human reviewer stays the gate.

## Install

```
/plugin install architecture-review@dev-digest-toolkit
```

This also installs its dependency [`engineering-paved-path`](../engineering-paved-path/README.md) (`^1.0.0`), whose skills hold the generic rules the agent applies.

## Components

| Component | Type | Details |
|---|---|---|
| `architecture-reviewer` | agent | sonnet, effort medium, max 30 turns. Tools: Read, Grep, Glob, Bash (read-only git, guarded), Skill. Denied: Write, Edit, NotebookEdit, Agent |
| `hooks/hooks.json` + `scripts/readonly-bash-guard.mjs` | PreToolUse hook | Limits the agent's Bash calls to single read-only git commands |

## How to use it

Mention it directly, ideally with what changed:

```
@agent-architecture-review:architecture-reviewer Review the working tree against main.
```

```
Use the architecture-reviewer agent on these files: src/modules/billing/service.ts, src/modules/billing/routes.ts. Rules: docs/architecture.md.
```

From an orchestrating skill or another session, spawn it with the Agent tool and `subagent_type: "architecture-review:architecture-reviewer"`.

### Inputs

| Input | Required | Notes |
|---|---|---|
| Changed files **or** a review bundle path | recommended | A bundle is one file with status, diff and untracked files; the agent reads it instead of re-running `git diff`. If neither is given, it derives the list from git once and asks before reviewing more than 40 files. |
| Architecture rules document | optional | First match wins: a path in your prompt → `architectureDoc` in `.claude/sdd-engineering.json` → the "Architecture" section of `CLAUDE.md` / `AGENTS.md`. Project rules override the generic ones. |
| Extra constraints | optional | For example the "Architecture constraints" section of an implementation plan. |
| `protectedPaths`, `modules` | optional | Read from `.claude/sdd-engineering.json` if present (see [sdd-engineering](../sdd-engineering/README.md#5-configuration)). |

### What it checks

**Pass 1, deterministic** (Grep on the changed files, hit counts reported, rules that do not fit your layout are skipped and listed):

| Rule id | Catches |
|---|---|
| `arch/layer-route-repo` | a route or controller calling a repository directly |
| `arch/layer-domain-infra` | services, ports or domain code importing HTTP frameworks, ORMs, DB drivers or SDK clients |
| `arch/service-new-infra` | a service constructing its own repositories or clients, or taking the whole container |
| `arch/raw-rows` | repositories returning ORM row or SDK types instead of domain types |
| `arch/cross-module` | importing another module's internals instead of its public entry point |
| `arch/client-imports-server` | frontend code importing backend source or server-only packages |
| `frontend/cross-feature` | one feature importing another feature's private components |
| `frontend/fetch-in-component` | HTTP calls inside presentational components |
| `frontend/server-client-boundary` | `'use client'` on a Next.js page or layout, server-only code reachable from client code |
| `arch/protected-path` | edits to vendored, generated or otherwise protected paths |
| `arch/project-rule` | deterministic rules from your architecture document |

**Pass 2, judgment** on the changed hunks: the "Review checklist" of each loaded skill, your architecture document and any plan constraints.

**Skills it loads**, only for the kinds of files that changed: `engineering-paved-path:onion-architecture`, `:fastify-best-practices`, `:react-frontend-architecture`, `:react-best-practices`, `:next-best-practices` and `:security` (boundary placement only, not a security audit).

### Report

```
# Architecture Review
## Scope            base, files reviewed and skipped, which rules source was used
## Verdict          CLEAN | CONCERNS | VIOLATIONS (advisory)
## Findings         | # | severity | rule id | file:line | evidence (quoted) | rule source | direction |
## Pre-existing     same columns, for violations in untouched lines
## Cannot verify    suspected issue → missing evidence
## Checks run       rules with hit counts, skills loaded, git commands
```

Severity: **critical** for dependency-rule breaks that spread (domain → infrastructure, leaked ORM rows, client → server imports, secrets reachable from client code, protected-path edits), **major** for local boundary violations, **minor** for placement and naming. A skill's own severity tags take precedence. Every finding is re-checked at its line before it is reported; anything unconfirmed goes to "Cannot verify".

## Guard: what is blocked

Plugin agents ignore the `hooks` frontmatter field, so the guard lives in the plugin's `hooks/hooks.json`. It runs before every Bash call in the session but **acts only when the caller is `architecture-review:architecture-reviewer`**; your own commands and other agents pass through untouched.

For the reviewer it allows a single `git diff|status|log|show|merge-base|rev-parse|ls-files|blame` command and blocks:

- shell metacharacters: newline, `;`, `&`, `|`, `<`, `>`, `` ` ``, `$`, `\`;
- git flags that write files, run programs or inject config: `--output`, `-o`, `--ext-diff`, `--textconv`, `-c`, `--config-env`;
- any other command.

A blocked call returns the reason to the agent, which then falls back to Grep, Glob and Read. The guard fails closed: unparsable hook input is blocked.

## What it runs and where data goes

- Read-only `git` commands and file reads in your working directory. No tests, installs or generators.
- `node` runs the guard script locally. Nothing is sent anywhere beyond your normal Claude Code session.

## Used by sdd-engineering

[`sdd-engineering`](../sdd-engineering/README.md) depends on this plugin. Its `/run-plan` skill runs `architecture-reviewer` in parallel with `plan-verifier` after every implementation pass, hands it a shared review bundle, and feeds critical and major findings back to the implementer in a fix loop.

## Origin

Adapted from the `architecture-reviewer` agent of [MShcherbyna/dev-digest](https://github.com/MShcherbyna/dev-digest). Changes: the rules hard-coded for that repository's packages were replaced with generic boundary rules, the project's own architecture document and the `engineering-paved-path` skills; the guard moved from agent frontmatter to `hooks/hooks.json` and was rewritten in Node.

## License

[MIT](../../LICENSE)
