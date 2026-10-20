# engineering-paved-path

The paved path for TypeScript web projects: 13 skills that teach Claude how to structure, write, test and secure code on a React / Next.js frontend and a Fastify / Drizzle / PostgreSQL backend.

The skills are plain knowledge: they don't run on their own, change settings or call external services. Claude loads one when the task matches its description, you can call one by name, and agents can preload them. Other plugins in this marketplace build on them:

- [`architecture-review`](../architecture-review/README.md) checks changed code against `onion-architecture`, `security` and the React / Next.js / Fastify skills.
- [`sdd-engineering`](../sdd-engineering/README.md) preloads them into its spec, plan and implementation agents.

Both declare `engineering-paved-path` as a dependency, so installing either one installs this plugin as well.

## Install

```
/plugin marketplace add MShcherbyna/dev-digest-toolkit-marketplace
/plugin install engineering-paved-path@dev-digest-toolkit
```

Run `/reload-plugins` (or restart Claude Code) afterwards.

## Skills

Every skill lives in the `engineering-paved-path` namespace.

| Skill | Scope | Use it when |
|---|---|---|
| `engineering-paved-path:react-best-practices` | Frontend | Writing, reviewing or refactoring React components, hooks and state; spotting anti-patterns and performance traps |
| `engineering-paved-path:react-frontend-architecture` | Frontend | Deciding where a component, constant, helper, hook or type goes; splitting components; the server/client boundary; barrel files |
| `engineering-paved-path:next-best-practices` | Frontend | Next.js App Router: file conventions, RSC boundaries, data patterns, route handlers, metadata, images, fonts, bundling, self-hosting |
| `engineering-paved-path:react-testing-library` | Frontend tests | Writing or reviewing React component and hook tests with RTL + Vitest: user-flow tests, query priority, `userEvent`, MSW |
| `engineering-paved-path:fastify-best-practices` | Backend | Fastify routes, plugins, JSON-schema validation, hooks, error handling, logging, performance, deployment |
| `engineering-paved-path:onion-architecture` | Backend | Designing or reviewing backend modules: dependency rule, ports and adapters, thin routes, repositories that return domain types |
| `engineering-paved-path:drizzle-orm-patterns` | Backend | Drizzle schemas, queries, relations, transactions and migrations |
| `engineering-paved-path:postgresql-table-design` | Backend | PostgreSQL schema design: data types, keys, constraints, indexing, partitioning |
| `engineering-paved-path:typescript-expert` | Full-stack | Advanced types, slow type checking, tsconfig and monorepo setup, JS → TS migration |
| `engineering-paved-path:zod` | Full-stack | Zod schemas: parsing, error handling, type inference, composition, performance |
| `engineering-paved-path:security` | Full-stack | OWASP Top 10:2025 review, auth and authorization, injection, uploads, secrets |
| `engineering-paved-path:mermaid-diagram` | Shared | Flowcharts, sequence diagrams, ERDs and state machines in Markdown |
| `engineering-paved-path:engineering-insights` | Shared | Reading a module's `INSIGHTS.md` at the start of a task and recording non-obvious findings at the end |

## Using the skills

**Automatically.** Claude picks a skill when your request matches its description, for example "where should this hook live?" loads `react-frontend-architecture`, "add a Fastify route" loads `fastify-best-practices` and `onion-architecture`.

**By name.** Type the namespaced skill as a slash command:

```
/engineering-paved-path:zod
/engineering-paved-path:security review the upload handler in src/modules/files
```

**From your own agents.** Preload skills in a subagent's frontmatter, or tell the agent to call them with the `Skill` tool:

```markdown
---
name: backend-reviewer
description: Reviews backend changes.
tools: Read, Grep, Glob, Skill
skills:
  - engineering-paved-path:onion-architecture
  - engineering-paved-path:security
---
```

## Project conventions win

The skills describe a sensible default, not your repository. Where a project documents its own rules — in `CLAUDE.md`, `AGENTS.md` or an architecture doc — `onion-architecture` and `react-frontend-architecture` tell Claude to follow those first and to mirror what existing code already does.

## Configuration

Nothing is required. One skill reads an optional project file:

`engineering-insights` finds the right `INSIGHTS.md` from `modules` in `.claude/sdd-engineering.json` (the same file [`sdd-engineering`](../sdd-engineering/README.md) uses):

```json
{
  "modules": [
    { "name": "api", "path": "apps/api", "insights": "apps/api/INSIGHTS.md" },
    { "name": "web", "path": "apps/web", "insights": "apps/web/INSIGHTS.md" }
  ]
}
```

Without that file it uses the nearest `INSIGHTS.md` above the files you touch, and the root `INSIGHTS.md` for work that spans several modules. It creates the file with its fixed sections the first time it has something worth recording.

## What it runs and where data goes

- No hooks, no MCP servers, no network calls of its own.
- Two optional helper scripts, run only when Claude decides to use them and you allow the command:
  - `onion-architecture/scripts/module-imports.sh <src-dir>` (bash) lists cross-module imports and import cycles under `<src-dir>/modules`. Read-only.
  - `typescript-expert/scripts/ts_diagnostic.py` (python3) prints TypeScript and Node versions, tsconfig and tooling detection, `npx tsc --noEmit` errors and `any`/`as` counts. It does not modify files; `npx` may download TypeScript if the project lacks it.
- `engineering-insights` writes only to `INSIGHTS.md` files in your project, and only when it has a finding worth recording.

## Third-party content and licenses

Several skills come from other open-source repositories. Each one keeps its source and license in its frontmatter (`license`, `metadata.source`), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) has the full license texts, attributions and the changes made here.

| Skill | Source | License |
|---|---|---|
| `fastify-best-practices` | [mcollina/skills](https://github.com/mcollina/skills) | MIT |
| `drizzle-orm-patterns` | [giuseppe-trisciuoglio/developer-kit](https://github.com/giuseppe-trisciuoglio/developer-kit) | MIT |
| `postgresql-table-design` | [wshobson/agents](https://github.com/wshobson/agents) | MIT |
| `zod` | [pproenca/dot-skills](https://github.com/pproenca/dot-skills) | MIT |
| `typescript-expert` | [sickn33/antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills) | MIT (code) + CC BY 4.0 (text) |
| `next-best-practices` | [vercel-labs/next-skills](https://github.com/vercel-labs/next-skills) | none stated |
| `react-best-practices`, `react-testing-library`, `security`, `mermaid-diagram` | [ai-agentic-engineering-neo/dev-digest](https://github.com/ai-agentic-engineering-neo/dev-digest) | MIT |
| `onion-architecture`, `react-frontend-architecture`, `engineering-insights` | this repository | MIT |

### A note on `next-best-practices`

Vercel no longer maintains this skill, and its source repository states no license. It is included as is with attribution and will be removed if the rights holder asks. For Next.js 16.3+ the maintained alternative ships with Next.js itself: `next dev` generates `AGENTS.md` / `CLAUDE.md` that point agents at the bundled, version-matched docs. See [Set up your Next.js project for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents).

## Versioning

See [CHANGELOG.md](CHANGELOG.md). Removing or renaming a skill is a major release, because other plugins and agents refer to the skills by name.

## License

[MIT](../../LICENSE), except where [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) says otherwise.
