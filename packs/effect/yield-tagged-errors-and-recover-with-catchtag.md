# Yield tagged errors and recover with catchTag
globs: `**/*.ts`
globs: `**/*.tsx`

Define expected failures with `Schema.TaggedErrorClass` (or `Data.TaggedError`). In `Effect.gen`, yield the error value directly (`yield* new NotFound({ id })`) instead of `yield* Effect.fail(new NotFound(...))`. Recover with `Effect.catchTag` / `catchTags` / Match on tags—not a broad catch that switches on `error._tag` by hand.

## Not allowed

```
yield* Effect.fail(new NotFound({ id }))
program.pipe(
  Effect.catchAll((error) =>
    error._tag === 'NotFound' ? fallback : Effect.fail(error),
  ),
)
```

## Exceptions

Defects and truly unknown failures may use cause-level handlers. Mapping a foreign error into a tagged domain error at an adapter boundary is fine.
