<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Section One Working Rules

- Use `pnpm` for all package, script, and lockfile work.
- Keep commits in Conventional Commit style, one or two lines, with no co-author trailers.
- Keep the product independent: do not use UT marks, Bevo branding, or official-affiliation language.
- Preserve the platform shape: team-specific choices belong in typed config, not scattered UI copy.
- Before product, UX, growth, or edition-expansion work, read `docs/future-work.md`. It records the
  current product thesis, evidence gates, and brand-redesign brief; hypotheses there are not shipped
  facts.
- Verify each slice with `pnpm check`, `pnpm build`, and a browser or Playwright smoke test before
  committing. For anything visual, check more than one viewport width and both themes: the layout
  bugs this project has actually shipped were correct at most widths and wrong at a few, and threw
  nothing. `docs/working-notes.md` records the trap that causes them.
- Follow `DESIGN.md` before changing any surface. It is the design contract, not a summary of the
  code, and it records why several obvious-looking choices are wrong.
- Handle failure to the standard in `docs/engineering-standards.md`: severity is `degraded` (log) or
  `error` (log and alert), reporting never changes control flow, and nothing sensitive reaches a log
  or an inbox.
