---
description: The architecture-review:architecture-reviewer agent can be dispatched by its namespaced name.
tags: [namespace, agent]
plugins: ["../..", "../../../engineering-paved-path", "../../../research-tools", "../../../architecture-review"]
runs: 1
max_turns: 12
allowed_tools: [Agent, Read, Glob, Grep]
---

Dispatch the architecture-review:architecture-reviewer agent (use that exact subagent_type) on this workspace. There are no changes to review; ask it to say so and to return its 'cannot verify' list. Report its answer.
