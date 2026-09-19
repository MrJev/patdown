# Decode at the boundary instead of runtime typeof
globs: `**/*.ts`
globs: `**/*.tsx`

Do not use ad hoc `typeof` narrowing to invent domain meaning for external values. Decode into a meaningful type at the I/O boundary (Schema, zod, etc.), then trust that type downstream.

## Not allowed

```
function port(raw: unknown) {
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string') return Number(raw)
  throw new Error('bad port')
}
```

## Exceptions

Existence probes against the string `'undefined'` (feature detection) are fine. User-defined type predicates that are themselves the boundary decode may inspect `typeof` when necessary.
