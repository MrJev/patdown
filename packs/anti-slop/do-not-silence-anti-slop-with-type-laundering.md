# Do not silence anti-slop with type laundering
globs: `**/*.ts`
globs: `**/*.tsx`

Do not rewrite code solely to evade a linter or type rule while preserving the same unsafe hole: renaming `any` to `unknown` then casting, replacing `as T` with `as unknown as T`, or introducing a local alias whose only purpose is to reintroduce `any`/`object`/`Record<string, unknown>` under another name. The judge should flag intent to launder, not creative spelling.

## Not allowed

```
type Loose = any
function f(x: Loose) { return x as User }
```

```
const data = payload as unknown as User
```

## Exceptions

A genuine refactor that introduces a named owner type and validates into it is fine. Schema brands and `satisfies` that keep evidence are fine.
