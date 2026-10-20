---
description: A skill from the engineering-paved-path dependency is reachable by its namespaced name when sdd-engineering is installed.
tags: [namespace, skill, dependency]
plugins: ["../..", "../../../engineering-paved-path", "../../../research-tools", "../../../architecture-review"]
runs: 2
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---

In my TypeScript API I parse the JSON body of a POST request with `JSON.parse` and cast it to `CreateUserInput`. Show me how to validate it properly with Zod instead, including how to return the validation errors to the client.
