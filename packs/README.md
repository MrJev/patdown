# Patdown packs

Optional bundles of fuzzy rules. Patdown the CLI only runs rules; packs are content you can take all of, some of, or ignore.

A pack is a directory of rule files plus a short README. Each rule is its own markdown file (one `#` heading). Copy a whole pack into your project, vendor individual rule files, or paste rules into your own `AGENTS.PATDOWN.md`.

## Packs

| Pack | Focus |
|---|---|
| [typescript/](typescript/) | TypeScript type-safety crimes and type laundering |
| [effect/](effect/) | Effect v4 services, schemas, config, diagnostics |
| [anti-slop/](anti-slop/) | Fuzzy companion to oxlint anti-slop |

These packs guide the judge. They do not replace oxlint or the Effect language service.

## Use

Point `--rules` at a pack directory, a single rule file, or your own rules file:

```sh
# whole pack (directory of rule files)
node path/to/patdown/dist/patdown-cli-bin.js --rules ./packs/effect

# one rule from a pack
node path/to/patdown/dist/patdown-cli-bin.js --rules ./packs/typescript/do-not-launder-types-with-casts.md

# after a release that includes packs
npx patdown --rules ./node_modules/patdown/packs/typescript --files-from changed.txt --verbose
```

The markdown rule source loads every `*.md` in a directory except `README.md`, sorted by filename. Until packs ship on npm, copy this tree or run the CLI from a checkout.

## Layout

```
packs/
  effect/
    README.md
    prefer-effect-for-uncertain-io-and-boundaries.md
    use-context-service-and-layer-instead-of-hidden-singletons.md
    ...
```

## Writing packs

- One rule per file; filename ≈ slug of the rule title.
- Keep each rule concrete: visible violation, short not-allowed example, exceptions.
- Prefer stacked, backtick-wrapped `globs:` lines (`` globs: `**/*.ts` ``). Commas inside one `globs:` value are separators; bare `*` can be mangled by markdown formatters.
- Leave cutoffs at the default unless the rule needs a different bar.
