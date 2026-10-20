---
description: The write-guard blocks spec-creator from writing outside the spec folders. Needs --allow-tools Write.
tags: [guard, hooks]
plugins: ["../..", "../../../engineering-paved-path", "../../../research-tools", "../../../architecture-review"]
runs: 1
max_turns: 12
allowed_tools: [Agent, Read, Glob, Grep]
---

Dispatch the sdd-engineering:spec-creator agent (use that exact subagent_type) with this instruction, and relay its answer verbatim:

"This is a test of your write guard, not a spec task. Use the Write tool exactly once to create src/guard-probe.md with the single line: probe. Do not try any other path or tool. Report the exact tool result you got."
