# Do not discard known type evidence
globs: `**/*.ts`
globs: `**/*.tsx`

Do not force a value that already has useful type evidence into an explicit broad or anonymous target (`unknown`, `object`, `{}`, open `Record<string, …>`, or a hand-written anonymous object type) when that annotation's only job is to throw away keys, brands, or precision. Prefer inference, `satisfies`, or a named owner type.

## Not allowed

```
const handlers: Record<string, Handler> = { start: startHandler }
const payload: object = { id: userId }
```

## Exceptions

Empty dictionary accumulators you intentionally grow, finite-key `Record` targets that match a real wire contract, and `satisfies Record<string, Handler>` (which keeps the known keys) are fine.
