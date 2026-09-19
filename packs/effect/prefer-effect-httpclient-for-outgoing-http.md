# Prefer Effect HttpClient for outgoing HTTP
globs: `**/*.ts`
globs: `**/*.tsx`

In Effect applications, prefer Effect `HttpClient` (and schema body decoders) over raw `fetch` / SDK defaults when you need typed errors, retries (`HttpClient.retryTransient`), and layer-provided clients. Keep business logic free of transport details.

## Not allowed

```
const res = yield* Effect.tryPromise(() => fetch(url))
const json = (yield* Effect.tryPromise(() => res.json())) as User
```

## Exceptions

Tiny scripts, non-Effect modules, and vendor SDKs wrapped once behind a service method are fine. Streaming uploads/downloads may use Stream/platform APIs instead of `res.json()`.
