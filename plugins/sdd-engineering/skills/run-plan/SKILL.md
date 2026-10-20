---
name: run-plan
description: Implements an approved plan end to end. `/sdd-engineering:run-plan <plan-path> [mode:single|multi] [max-fix:N]` runs implementer, check-runner, then architecture-reviewer + plan-verifier in a fix loop (max 3 iterations) until clean. Spec and plan are written beforehand with the spec-creator and implementation-planner agents. Manual invocation only; run it in a fresh chat.
disable-model-invocation: true
argument-hint: "<plan-path> [mode:single|multi] [max-fix:N]"
---

# /run-plan

You, the main session, orchestrate. Subagents cannot spawn subagents, so call
each agent yourself, by its namespaced name, and never do its job inline:

| Step | Agent |
|---|---|
| implement, fix | `sdd-engineering:implementer` |
| run checks | `sdd-engineering:check-runner` |
| architecture review | `architecture-review:architecture-reviewer` |
| plan audit | `sdd-engineering:plan-verifier` |

Input: `$ARGUMENTS` = path to an approved `<plansDir>/<feature>_en.md` with
sections 5, 7, 8 and 12. Missing or incomplete: say what, stop.

Optional arguments (any order, after the path):
- `mode:single` or `mode:multi` overrides the execution mode in plan section
  12 (default: the plan's mode). Note the override in the ledger.
- `max-fix:N` caps fix-loop iterations (default 3, integer 0-5; 0 = review
  once, no fixes). Unknown or invalid arguments: say so and stop.

Configuration: read `.claude/sdd-engineering.json` in the project root
(optional). Use `runsDir` (default `.claude/sdd-runs`) for the ledger and the
bundles, and `modules[]` to map changed files to modules. If `runsDir` is not
git-ignored, say once that it should be.

Rules: pass paths and short summaries between agents, never pasted reports.
Do not commit, push or run any `forbiddenCommands`. Full test suites run
**only** through `check-runner`; tell the implementer in its prompt:
typecheck plus targeted tests for files it touched, no module-wide suite.

## Steps

1. **Ledger.** Create `<runsDir>/<feature>.md`: plan path, spec path (from
   plan section 1), iteration counter, findings table
   `id | source | severity | file:line | status | note`; status is
   `open | fixed | deferred | disputed`. Update after every step.
2. **Implement.** Invoke `sdd-engineering:implementer` with the plan path.
   Mode from `mode:` or, by default, plan section 12: multi-agent = one
   implementer per non-overlapping parallel lane in one message;
   single-agent = one pass.
3. **Checks.** Invoke `sdd-engineering:check-runner` for the touched modules.
   Failures go to the implementer as a fix pass (counts as an iteration)
   before any review. `not configured` is not a failure: note it in the
   ledger and continue.
4. **Bundle.** Run
   `node "${CLAUDE_SKILL_DIR}/scripts/review-bundle.mjs" <runsDir>/<feature>-bundle.md`.
   It writes one file with git status, the diff and untracked files,
   skipping `reviewBundleExcludes` from the configuration.
5. **Review (parallel, one message).**
   `architecture-review:architecture-reviewer` (changed-file list + bundle,
   plus `architectureDoc` if configured) and `sdd-engineering:plan-verifier`
   (plan path, bundle, check-runner report).
6. **Triage.** critical/major -> `open`; minor -> `deferred`; verifier
   FAIL/PARTIAL -> `open` (major). Stable id = rule id + file, or verifier id.

## Fix loop (max `max-fix` iterations, default 3)

While any `open` finding exists and iteration < `max-fix`:

1. iteration += 1. Invoke `sdd-engineering:implementer` with **only** the open
   findings (id, file:line, quoted evidence, rule, direction). It may mark
   one `disputed` with a one-line argument instead of changing code.
2. `sdd-engineering:check-runner`; failures go back to step 1.
3. New bundle with the diff since the previous bundle:
   `node "${CLAUDE_SKILL_DIR}/scripts/review-bundle.mjs" <runsDir>/<feature>-bundle-<n>.md <base-ref>`.
4. Narrow re-review in parallel: `architecture-review:architecture-reviewer`
   limited to the open rule ids plus files changed this iteration;
   `sdd-engineering:plan-verifier` in `narrow` mode with the open ids. Update
   the ledger.
5. Stop and ask the user if a finding id returns a second time or a critical
   one is `disputed`.

Exit: no `open` critical/major and verifier COMPLETE -> finish. Limit reached
with `open` items -> print the ledger summary and ask the user.

## Finish

Report: what was built, iterations used, `deferred` minor findings,
`disputed` items, anything NOT VERIFIABLE, documentation the plan asked to
update (as a to-do for the user; this skill does not write docs), and that
nothing is committed. Suggest `/sdd-engineering:workflow-retro` to analyse the
run.
