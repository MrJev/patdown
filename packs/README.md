# Patdown packs

Ready-made rule files you can point at with `--rules`. Each pack is ordinary markdown: one `#` heading per rule, optional `globs:` / `yes-threshold:` under the heading.

## Packs

| File                           | Focus                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| [typescript.md](typescript.md) | TypeScript crimes: invalid states, type laundering, weak boundaries                           |
| [effect.md](effect.md)         | Effect v4 production defaults: services, schemas, config, errors                              |
| [anti-slop.md](anti-slop.md)   | Fuzzy companion to oxlint anti-slop: widen-then-assert, silence-by-cast, empty-object spreads |

These packs are guidance for the judge. They do not replace oxlint or the Effect language service; they catch patterns those tools miss or that agents invent to dodge them.

## Use

```sh
npx patdown --rules ./node_modules/patdown/packs/typescript.md
npx patdown --rules ./packs/effect.md --files-from changed.txt --verbose
```

Until packs ship on npm, copy this directory into your repo or run from a checkout of patdown.

Combine packs by listing multiple files is not supported yet: pass one rules file per run, or concatenate the markdown into a project `AGENTS.PATDOWN.md`.

## Writing more packs

Keep each rule concrete: say what a violation looks like in source, give a short "not allowed" example, and list exceptions. Prefer patterns visible in one file. Leave cutoffs at the default unless the rule needs a different bar.
