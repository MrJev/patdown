# Prefer Schema and tagged errors at Effect boundaries
globs: `**/*.ts`
globs: `**/*.tsx`

Decode unknown input with Schema effectful decoders. Model expected failures as tagged errors (`Schema.TaggedErrorClass` / `Data.TaggedError`) and recover with `catchTag` / `catchTags`. Do not use `as` to skip schema validation, and do not wrap a yieldable tagged error in `Effect.fail` when yielding it directly works.

## Not allowed

```
const body = JSON.parse(text) as CreateUser
yield* Effect.fail(new NotFound({ id }))
```

## Exceptions

Trusted internal construction may use `schema.make`. Unknown-input decoding at dynamic import or other untyped host boundaries is appropriate. Tests may construct tagged errors directly.
