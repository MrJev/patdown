# Keep service method requirements empty
globs: `**/*.ts`
globs: `**/*.tsx`

`Context.Service` method signatures should not require services in `R`. Acquire dependencies in `Layer.effect` / layer construction and close them over inside methods so callers see `Effect<A, E>` (or `R = never`), not a leak of `HttpClient`, `FileSystem`, etc. Unique service ids (`@app/Users`) and `readonly` method fields are part of the same contract.

## Not allowed

```
class Users extends Context.Service<Users, {
  readonly find: (id: UserId) => Effect.Effect<User, E, HttpClient.HttpClient>
}>()('@app/Users') {}
```

## Exceptions

Framework request-scoped values that are intentionally leakable (documented with `@effect-leakable-service` / `@effect-expect-leaking`) are fine. Layers themselves may require services; only the **provided service methods** should not.
