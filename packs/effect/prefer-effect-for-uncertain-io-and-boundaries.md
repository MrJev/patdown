# Prefer Effect for uncertain IO and boundaries
globs: `**/*.ts`
globs: `**/*.tsx`

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
