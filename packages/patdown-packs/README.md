# @patdown/packs

Optional fuzzy rule packs for [patdown](https://github.com/tyler-dot-earth/patdown). Content only: the CLI still just runs rules.

Install:

```sh
pnpm add -D @patdown/packs
```

Compose with project rules in `AGENTS.PATDOWN.md`:

```
---
include: ./node_modules/@patdown/packs/typescript
---

# No title case
globs: **/*.md

Markdown headings must use sentence case.
```

Or point `--rules` at a pack directory or one rule file:

```sh
npx patdown --rules ./node_modules/@patdown/packs/typescript
npx patdown --rules ./node_modules/@patdown/packs/typescript/do-not-launder-types-with-casts.md
npx patdown --rules ./node_modules/@patdown/packs/effect --files-from changed.txt --verbose
```

Subpath imports resolve the same files:

```ts
import typescriptPack from '@patdown/packs/typescript'
import launder from '@patdown/packs/typescript/do-not-launder-types-with-casts.md'
```

`@patdown/rules` is the parser library. These are markdown files, not that package.

Source of truth in the repo is [`packs/`](../../packs/README.md). This package copies that tree at pack time.
