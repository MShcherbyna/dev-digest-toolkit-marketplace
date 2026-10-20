---
description: Diagnostic. Shows whether a plugin agent's cross-plugin skills from the skills frontmatter are preloaded (no Skill call needed) or loaded through the Skill fallback.
tags: [preload, skill, dependency]
plugins: ["../..", "../../../engineering-paved-path", "../../../research-tools", "../../../architecture-review"]
runs: 1
max_turns: 12
allowed_tools: [Agent, Read, Glob, Grep, Skill]
---

Dispatch the sdd-engineering:implementer agent (use that exact subagent_type) with this instruction, and relay its answer verbatim:

"This is a configuration check, not a task. Do not read, edit or run anything. List the names of the skills whose full content is already in your context, then stop."
