---
description: The research-tools:researcher agent can be dispatched by its namespaced name.
tags: [namespace, agent]
plugins: ["../..", "../../../engineering-paved-path", "../../../research-tools", "../../../architecture-review"]
runs: 1
max_turns: 12
allowed_tools: [Agent, Read, Glob, Grep]
---

Use the research-tools:researcher agent (dispatch it with that exact subagent_type) to find out what the EARS notation for requirements is and list its five patterns. Report what it found.
