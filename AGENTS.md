# Stackivo Agent Instructions

## Design System

Always read `DESIGN.md` and `design-system/MASTER.md` before making visual or UI
decisions. Font choices, colours, spacing, layout, component hierarchy, motion
and the Calm Command direction are defined there.

Do not use `design-system/MASTER.v1.md` or `design-system/MASTER.v2.md` as current
authority. Do not deviate from the active system without explicit user approval.
In QA or review work, flag implementation that does not match the active master.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
