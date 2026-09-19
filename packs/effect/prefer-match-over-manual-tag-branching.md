# Prefer Match over manual tag branching
globs: `**/*.ts`
globs: `**/*.tsx`

For tagged unions and Effect tagged errors, prefer `Match` / `Predicate.isTagged` / tagged-enum `$match` over manual `if (value._tag === 'X')` chains or `switch (value._tag)`. Construct tagged values with their Schema / `Data.taggedEnum` constructors instead of writing `{ _tag: 'X', ... }` literals.

## Not allowed

```
if (result._tag === 'Success') return result.value
const err = { _tag: 'NotFound', id } as NotFound
```

## Exceptions

`Match.when` / pattern objects that mention `_tag` as part of Match itself are fine. Test fixtures may build tagged literals when no constructor exists yet.
