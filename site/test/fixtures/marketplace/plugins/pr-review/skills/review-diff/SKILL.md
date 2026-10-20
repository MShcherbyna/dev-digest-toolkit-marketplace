---
name: review-diff
description: Reviews the current git diff for bugs, missing tests and risky changes. Use when the user asks to review a pull request, a diff or staged changes.
allowed-tools: Read, Grep, Bash(git diff:*)
---

# Review diff

1. Run `git diff` against the base branch.
2. Read every changed file in full.
3. Report findings ordered by severity.
