---
name: design
description: "Decides which visual reference is the source of truth for UI work. Use whenever the task involves design, UI, layout, styling, colors, typography, spacing, a new page or a component's look, 'match the mockup', 'as in the design', or matching a screenshot. Screenshots pasted in the chat take priority over the reference files in the project's design folder."
---

# Design

Decides which visual reference to follow when specifying, building or
changing UI.

## Source priority

1. **Screenshots pasted in the chat** — highest priority. They always win.
2. **Files in the design folder** — `designDir` from
   `.claude/sdd-engineering.json` in the project root, default `design/`. The
   fallback reference for anything the screenshots do not cover.
3. **Neither covers it** — ask the user. Do not invent visuals.

If a chat screenshot conflicts with a design file, follow the screenshot and
mention the conflict in one line.

## Reading design files

- Design exports are often large standalone HTML or image files. **Never
  `Read` a large HTML export whole.** Check the size with Glob/`ls` first.
- File names may contain spaces or parentheses: quote the path, and expect
  the file to be renamed between versions.
- To inspect an HTML export, open it in a browser tool if one is available
  (navigate to `file:///<absolute path>`, then snapshot or screenshot), or
  `grep` for tokens (colors, fonts, spacing). Images can be read directly.

## Rules

- Do not redesign, simplify, or add visual elements unless explicitly asked.
  Follow the project's design policy in `CLAUDE.md` / `AGENTS.md` if it has
  one.
- Place files per the project's frontend architecture (for React projects,
  the `engineering-paved-path:react-frontend-architecture` skill). Never edit
  vendored UI kits by hand.

## Verification

Before calling UI work done, screenshot the running app and compare it
against the reference you followed (chat screenshot first, otherwise the
design file). If no browser tool is available, say that the visual check was
not done.
