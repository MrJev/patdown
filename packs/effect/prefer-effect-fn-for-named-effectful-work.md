# Prefer Effect.fn for named effectful work
globs: `**/*.ts`
globs: `**/*.tsx`

In Effect v4 modules, define public and non-trivial service methods with `Effect.fn("Domain.operation")` (generator or effect-returning) so call sites get tracing spans. Use `Effect.fnUntraced` only for internal helpers where span metadata is intentionally unnecessary. Prefer `Effect.gen` for sequencing over nested `flatMap` chains.

## Not allowed

```
const get = (id: UserId) =>
  Effect.gen(function* () {
    return yield* repo.find(id)
  })
```

```
function load() {
  return fetchUser.pipe(Effect.flatMap(processUser))
}
```

## Exceptions

Trivial one-liners that only `yield*` another named effect may stay unnamed. Test-only helpers may be untraced. Non-Effect pure functions are out of scope.
