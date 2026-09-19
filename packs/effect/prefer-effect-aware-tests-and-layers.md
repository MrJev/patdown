# Prefer Effect-aware tests and layers
globs: `**/*.test.ts`
globs: `**/*.test.tsx`
globs: `**/tests/**/*.ts`
globs: `**/tests/**/*.tsx`

Test Effect programs with `@effect/vitest` (`it.effect`), explicit test Layers, and `TestClock` / Deferred / Queue synchronization. Do not `Effect.runSync` / `runPromise` inside ordinary `async` tests just to avoid Effect test tooling, and do not sleep to wait for fibers.

## Not allowed

```
it('loads', async () => {
  const user = await Effect.runPromise(loadUser(id))
  await new Promise((r) => setTimeout(r, 50))
  expect(user.id).toBe(id)
})
```

## Exceptions

Pure non-Effect unit tests stay on plain Vitest. Contract tests against a real HTTP server may use async/await at the outer edge while the app under test remains Effectful.
