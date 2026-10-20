---
description: The sdd-engineering:plan-verifier agent can be dispatched by its namespaced name.
tags: [namespace, agent]
plugins: ["../..", "../../../engineering-paved-path", "../../../research-tools", "../../../architecture-review"]
runs: 1
max_turns: 12
allowed_tools: [Agent, Read, Glob, Grep]
---

Dispatch the sdd-engineering:plan-verifier agent (use that exact subagent_type) with the plan path docs/plans/missing-feature_en.md. Report what it answers.
