---
name: onion-architecture
description: Enforces Onion Architecture (dependency rule, ports/adapters, thin routes, repositories returning domain types) for new and changed backend modules of a Node.js/TypeScript service laid out as src/modules/<module>/. Use BEFORE answering or writing code whenever asked how to design, structure or lay out a backend module, its layers or their dependencies (routes, service, repository, ports, adapters, DI container), and when creating or refactoring a module, adding a service, repository, port or adapter, wiring the DI container, writing Fastify routes, Drizzle queries or Zod schemas on the backend, or reviewing layer dependencies. Also triggers on "новий модуль", "розкласти залежності між шарами", "архітектура модуля". Backend only; for React/Next.js use engineering-paved-path:react-frontend-architecture.
---

# Onion Architecture (backend)

Target-state rules for **new and touched modules** of a backend service whose code lives in `src/modules/<module>/`. Do not rewrite untouched modules just to comply; when you edit an existing module, move it toward these rules only as far as the change requires.

If the project documents its own architecture (a section in `CLAUDE.md` / `AGENTS.md`, or an architecture doc), its rules win where they differ from this skill.

We use a **lightweight** variant: keep `routes.ts → service.ts → repository.ts`, add `ports.ts` (and `domain/` only when a module has real business rules). Simple CRUD modules need just ports + no leaked DB rows.

## The Dependency Rule

Code may depend on layers more central, never on layers further out **[S1]**. Domain and application code must compile and run without Fastify, Drizzle, Postgres or any SDK.

| Layer (center → edge) | Lives in | May import |
|---|---|---|
| Domain: entities, value objects, pure rules | `modules/<x>/domain/` (optional), the shared types package | nothing but TS |
| Application: use cases + ports | `service.ts`, `ports.ts` | Domain |
| Infrastructure: repositories, adapters | `repository.ts`, `src/adapters/**` | Domain, Application (ports) |
| Presentation | `routes.ts`, Zod request/response schemas | Application |
| Composition root | `container.ts`, `app.ts` | everything |

Ports (interfaces such as `OrderStore`, `PaymentGateway`) are defined in the **application** layer; infrastructure implements them. Repository interfaces are persistence abstractions, so they belong in application, not domain **[S3]**.

## Rules per tool

**Fastify** (see also `engineering-paved-path:fastify-best-practices`)
- A route only parses input, calls one service method, maps status codes. No SQL, no SDK calls, no business rules.
- Each module is an encapsulated plugin **[S12]**. Share dependencies via `app.container` / `decorate` at the root scope, never module-level singletons.
- Domain errors are thrown by services and mapped to HTTP in one error handler, not per route.

**Zod** (see also `engineering-paved-path:zod`)
- Request/response schemas live at the edge (routes, the shared contracts package). Validate on the way in; services receive already-parsed typed input.
- Domain code does not import `zod`.

**Drizzle** (see also `engineering-paved-path:drizzle-orm-patterns`)
- Table objects, `$inferSelect`/`$inferInsert` and `drizzle-orm` imports stay inside `repository.ts`.
- A repository implements a port and returns **domain/shared types via a mapper**, never raw rows **[S16, S17]**.
- Transactions **[S15]**: accept an optional `tx` parameter (or a transaction-manager port) so a use case can span repositories atomically. Services never touch `db`.
- Follow the project's column naming convention consistently (for example explicit snake_case names).

**Adapters (HTTP clients, LLM SDKs, git, payment or email providers)**
- SDK types never leave the adapter. Expose only your own interfaces (ports and shared types).
- New external dependency = new port + adapter + a fake/mock implementation for tests.

**DI / Container**
- Services take **narrow ports via constructor** (`{ store: OrderStore, payments: PaymentGateway, jobs: JobPort }`), not the whole container, and do not `new` their repositories.
- Only the composition root instantiates concrete classes.

**Jobs / SSE**
- Job handlers are application-level (they call services). SSE or queue transport is infrastructure.

**Modules**
- A module does not import another module's `constants`, `helpers` or `repository`. Cross-module needs go through a port exposed from the composition root or a module `index.ts` facade.
- To list cross-module imports and cycles, run the helper script:
  `bash "${CLAUDE_SKILL_DIR}/scripts/module-imports.sh" <src-dir-that-contains-modules>`

**Tests**
- Domain/application: unit tests (`*.test.ts`) with in-memory fake ports.
- Infrastructure: integration tests (for example `*.it.test.ts` with Testcontainers).

## Review checklist

1. Any `fastify`, `drizzle-orm`, `postgres` or SDK import (`openai`, `@anthropic-ai/sdk`, `octokit`, …) in `service.ts`, `ports.ts` or `domain/`?
2. Does `service.ts` import the container or `new` a repository/adapter?
3. Does a repository method return `$inferSelect` rows or SDK types?
4. Does a route contain SQL, SDK calls or branching business rules?
5. Are ports declared in the application layer and implemented outward?
6. Does the module reach into another module's internals?
7. Can the service be unit-tested with fakes and no DB?
8. Are secrets accessed only through a dedicated config/secrets port, not read from `process.env` deep inside services?
9. Are new adapters registered in the container and given a fake for tests?
10. Did you leave generated code, vendored code, migrations and lockfiles untouched?

## Do not

- Collapse `routes/service/repository` into one file.
- Add a `domain/` folder to a module with no business rules just for symmetry.
- Hand-edit vendored code or generated migrations.

See [examples.md](examples.md) for good/bad code and [sources.md](sources.md) for the source registry (S#).
