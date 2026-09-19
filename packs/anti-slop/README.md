# anti-slop pack

Fuzzy markdown counterpart to **[Dillon Mulroy](https://github.com/dmmulroy)'s [anti-slop](https://github.com/dmmulroy/anti-slop)** generic Oxlint rules. Credit to Mulroy for the ruleset and the “reject low-evidence TypeScript” framing; this pack rephrases those generic rules for a judge instead of an AST linter.

Use it when you want a **judge-backed** check for the same type-laundering patterns static anti-slop rejects. Keep Oxlint anti-slop for exact AST hits; use this pack for paraphrases, multi-step laundering, and “looks fine to the linter” refactors.

Effect-specific anti-slop stays in [`../effect`](../effect/) (or Oxlint's `anti-slop-effect` group), not here. Spacing autofix (`require-readable-spacing`) stays a formatter concern and is omitted.

## Rules

| Rule | Static cousin |
|---|---|
| [Do not chain type assertions](do-not-chain-type-assertions.md) | `no-chained-type-assertions` |
| [Do not widen then assert](do-not-widen-then-assert.md) | `no-widen-then-assert` |
| [Do not discard known type evidence](do-not-discard-known-type-evidence.md) | `no-known-value-widening` |
| [Require a SAFETY comment for type assertions](require-a-safety-comment-for-type-assertions.md) | `require-safety-comment-for-type-assertion` |
| [Do not pass unknown through function contracts](do-not-pass-unknown-through-function-contracts.md) | `no-unknown-parameters`, `no-unknown-returns`, `no-unknown-type-aliases` |
| [Prefer named owner types over escape-hatch dictionaries](prefer-named-owner-types-over-escape-hatch-dictionaries.md) | `no-unsafe-dictionary-type`, `no-object-parameters` |
| [Do not hide omission behind empty-object spreads](do-not-hide-omission-behind-empty-object-spreads.md) | `no-conditional-empty-object-spread` |
| [Prefer one pass over filter-then-map](prefer-one-pass-over-filter-then-map.md) | `no-array-filter-map` |
| [Do not copy growing reducer accumulators](do-not-copy-growing-reducer-accumulators.md) | `no-reduce-accumulator-copy` |
| [Decode at the boundary instead of runtime typeof](decode-at-the-boundary-instead-of-runtime-typeof.md) | `no-runtime-typeof` |
| [Prefer typed access over Reflect get and apply](prefer-typed-access-over-reflect-get-and-apply.md) | `no-reflect-get`, `no-reflect-apply` |
| [Replace dependencies through real seams](replace-dependencies-through-real-seams.md) | `no-module-mocking` |
| [Do not put shape in symbol names](do-not-put-shape-in-symbol-names.md) | `no-shape-in-symbol-names` |

## Use

```sh
pnpm -w patdown -- --rules ./packs/anti-slop --files-from changed.txt --verbose
```
