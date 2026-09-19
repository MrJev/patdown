# Prefer Schedule and TestClock over Date and sleep
globs: `**/*.ts`
globs: `**/*.tsx`

In Effect programs and tests, use `Clock` / `TestClock` and `Schedule` (`retry`, `repeat`, spaced/exponential policies) instead of `Date.now`, `new Date()` for control flow, or `Effect.sleep` / real timers to wait for concurrency. Timeouts and retries belong in `.pipe(Effect.timeout, Effect.retry(schedule))`.

## Not allowed

```
const started = Date.now()
yield* Effect.sleep('1 second') // in a test waiting for a fiber
```

## Exceptions

Formatting a timestamp for display/logs may use clock time you already read. One-shot demos/scripts outside the Effect runtime are out of scope.
