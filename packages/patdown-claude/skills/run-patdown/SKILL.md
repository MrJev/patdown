---
name: run-patdown
description: Run the patdown CLI against files or a directory using project AGENTS.PATDOWN.md rules. Use when the user asks to fuzzy-lint, patdown a tree, or check writes against markdown rules.
---

# Run patdown

Use the project-installed CLI only. Install first:

```sh
pnpm add -D patdown @patdown/rules
```

Then run with `pnpm exec patdown` (or `pnpm -w patdown --` in this monorepo). Do not use bare `npx patdown`; that can fetch whatever the registry currently resolves.

Needs `TYPESAFE_API_KEY` for the default TypeSafe/Jev judge.

## Common invocations

Changed / explicit files:

```sh
pnpm exec patdown --verbose --files path/to/file.ts
pnpm exec patdown --verbose --files src
git diff --name-only --diff-filter=ACMR HEAD | pnpm exec patdown --files-from -
```

Print loaded rules (includes frontmatter packs):

```sh
pnpm exec patdown rules
```

Ask a one-off yes/no without linting files:

```sh
pnpm exec patdown ask "Is this markdown heading title case?" --input-text "# Hello World"
```

## Notes

- Default rules walk: `AGENTS.PATDOWN.md` from cwd up. `--rules` replaces that walk.
- Frontmatter `include:` composes pack directories or individual rule files.
- Quiet mode prints one `PASS`/`FAIL` line per judgment. `--verbose` streams per-rule boxes.
- This skill does not replace the Write/Edit PreToolUse hook. The hook blocks violating writes before disk; this skill is for on-demand tree lint.
