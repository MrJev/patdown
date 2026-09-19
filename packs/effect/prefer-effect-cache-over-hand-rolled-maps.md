# Prefer effect Cache over hand-rolled maps
globs: `**/*.ts`
globs: `**/*.tsx`

For keyed lookup caches with TTL and in-flight dedupe, prefer `Cache.make` / `Cache.makeWith` (or `Effect.cached` / `cachedWithTTL` for a single effect) over a module-level `Map` plus manual prune timers and promise dedupe. Use `Request` / `RequestResolver` only when a real batch endpoint exists.

## Not allowed

```
const cache = new Map<string, { value: User; expires: number }>()
const inflight = new Map<string, Promise<User>>()
```

## Exceptions

Tiny process-local memo tables with clear ownership and no TTL/dedupe requirements are fine. Caches owned by an external library are out of scope.
