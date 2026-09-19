# Do not launder types with casts
globs: `**/*.ts`
globs: `**/*.tsx`

Do not use `as`, non-null assertions, or chained assertions to make a value look like a narrower type after discarding evidence. Validate at the boundary or keep the precise type. A cast whose only job is to silence the type checker is a violation.

## Not allowed

```
const id = raw as UserId
const value = (data as unknown as Config).port!
```

## Exceptions

`as const` is fine. A cast next to a `SAFETY:` comment that names the invariant is fine when the surrounding code actually establishes that invariant. Test fixtures that build incomplete objects for a fake may cast when the fake's contract is intentional.
