# Do not widen then assert
globs: `**/*.ts`
globs: `**/*.tsx`

Do not annotate a known value as a broad type (`unknown`, `any`, `object`, `{}`, or a wide anonymous shape) and later assert it back to a narrower type. Keep the precise type from initialization through use, or parse once at the boundary into the narrow type.

## Not allowed

```
const value: unknown = getConfig()
const port = (value as Config).port
```

```
const row = { id: userId } as Record<string, unknown>
const id = row.id as UserId
```

## Exceptions

A single decode step from `unknown` through Schema (or another parser) into a named type is fine. Interop with a library that requires `unknown` at its boundary is fine when you decode immediately.
