# Prefer Effect for uncertain IO and boundaries

globs: **/_.ts
globs: \**/_.tsx

In modules that already use Effect, wrap external IO and untrusted input with Effect APIs instead of bare `async`/`await`, raw `fetch`, or unchecked JSON. Prefer `Effect.tryPromise`, `HttpClient`, `Schema.decodeUnknownEffect`, and tagged errors over try/catch that returns `any` or swallows failures.

## Not allowed

```
async function load() {
  const res = await fetch(url)
  return (await res.json()) as User
}
```

## Exceptions

Trivial pure helpers, type-only files, and one-line glue that does not perform IO are fine. Test setup that intentionally uses platform APIs outside an Effect is fine when the code under test is still Effectful.

# Use Context.Service and Layer instead of hidden singletons

globs: **/_.ts
globs: \**/_.tsx

Application dependencies that call networks, disks, clocks, or process env should be `Context.Service` values provided by `Layer`, not module-level mutable singletons or direct `process.env` reads in business logic. Reading config through `Config` / `ConfigProvider` inside a layer is required when the value varies by environment.

## Not allowed

```
export const db = new Pool(process.env.DATABASE_URL)
export function getUser(id: string) { return db.query(id) }
```

## Exceptions

Process entrypoints may read env while building layers. True constants (literal URLs for public docs, fixed algorithm names) may stay as module constants. Scripts and one-off tools are fine.

# Prefer Schema and tagged errors at Effect boundaries

globs: **/_.ts
globs: \**/_.tsx

Decode unknown input with Schema effectful decoders. Model expected failures as tagged errors (`Schema.TaggedErrorClass` / `Data.TaggedError`) and recover with `catchTag` / `catchTags`. Do not use `as` to skip schema validation, and do not wrap a yieldable tagged error in `Effect.fail` when yielding it directly works.

## Not allowed

```
const body = JSON.parse(text) as CreateUser
yield* Effect.fail(new NotFound({ id }))
```

## Exceptions

Trusted internal construction may use `schema.make`. Unknown-input decoding at dynamic import or other untyped host boundaries is appropriate. Tests may construct tagged errors directly.

# Address Effect diagnostics instead of dodging them

globs: **/_.ts
globs: \**/_.tsx

Use Effect compiler and language-service suggestions to improve the implementation. Do not silence diagnostics or add indirection that only exists to evade a check.

Clear violations include:

- A zero-argument service method that only returns an Effect when an Effect-valued member would do. Effects are already lazy.
- Synchronous schema decoding inside an Effect workflow when an effectful decoder would preserve the typed error channel.
- Using an unknown-input schema decoder when the input already has the schema's encoded type.
- Suppressing an Effect diagnostic without a specific explanation of why it does not apply.

## Exceptions

Unknown-input decoding at untyped boundaries (dynamic imports, host JSON) is fine. A diagnostic suppression with a comment that names the invariant is fine when that invariant is real.
