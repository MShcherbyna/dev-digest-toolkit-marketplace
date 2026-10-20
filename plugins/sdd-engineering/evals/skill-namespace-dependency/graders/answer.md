---
type: llm
---

PASS if the reply validates the body with a Zod schema (safeParse or parse with error handling) and infers the type from the schema instead of casting.
FAIL if it keeps the cast as the source of the type or does not show how validation errors reach the client.
