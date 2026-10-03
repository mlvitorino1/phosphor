<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Phosphor conventions

- Read `docs/architecture.md` before changing module boundaries.
- Pure rules and client-safe types belong in `src/lib/domain`.
- Filesystem, credentials, network adapters and database access belong in `src/lib/server` with `server-only`.
- Keep components in their feature folder and routes thin. Explain invariants with short comments.
- Run `npm run check` and `npm run build` after relevant changes.
- Use synthetic fixtures. Never send real e-mails or use an operator's database during tests.
- Create new numbered SQL migrations; never edit an applied migration.
- Never commit `data/`, real environment files, account data or generated workers/builds.
