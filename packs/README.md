# Patdown packs

A **pack** is a directory of rule files plus a short README. Each rule is its own markdown file (one `#` heading). That keeps packs composable and reviewable without dumping a dozen rules into one blob.

## Packs

| Pack                       | Focus                                             |
| -------------------------- | ------------------------------------------------- |
| [typescript/](typescript/) | TypeScript type-safety crimes and type laundering |
| [effect/](effect/)         | Effect v4 services, schemas, config, diagnostics  |
| [anti-slop/](anti-slop/)   | Fuzzy companion to oxlint anti-slop               |

These packs guide the judge. They do not replace oxlint or the Effect language service.

## Use

`--rules` accepts a pack directory or a single markdown file:

```sh
npx patdown --rules ./packs/effect
npx patdown --rules ./packs/typescript --files-from changed.txt --verbose
```

The loader reads every `*.md` in the directory except `README.md`, sorted by filename. Until packs ship on npm, copy this tree or run from a checkout.

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
- Prefer stacked `globs:` lines (`**/*.ts` then `**/*.tsx`). Commas inside one `globs:` value are separators.
- Leave cutoffs at the default unless the rule needs a different bar.
