# Prefer Schema and tagged errors at Effect boundaries
globs: `**/*.ts`
globs: `**/*.tsx`

Decode unknown input with Schema effectful decoders (`Schema.decodeUnknownEffect`, schema body decoders). Model expected failures as tagged errors (`Schema.TaggedErrorClass` / `Data.TaggedError`). Do not use `as` to skip schema validation. Prefer Struct+interface records (see the Struct/brands rule); do not reach for Schema.Class just to hold fields.

## Not allowed

```
const body = JSON.parse(text) as CreateUser
yield* Effect.fail(new NotFound({ id }))
```

## Exceptions

Trusted internal construction may use `schema.make`. Unknown-input decoding at dynamic import or other untyped host boundaries is appropriate. Tests may construct tagged errors directly.
