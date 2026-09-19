# Keep branded and precise types through boundaries
globs: `**/*.ts`
globs: `**/*.tsx`

Do not strip branded or precise types by re-annotating them as `string`, `number`, `object`, `unknown`, or an anonymous structural type when the branded/precise type is still available. Prefer deriving with `Pick`, `Omit`, `Parameters`, `ReturnType`, or the schema's type.

## Not allowed

```
function save(userId: string) { /* userId was UserId one call up */ }
const row: { id: string } = brandedUser
```

## Exceptions

Encoding to JSON/storage where the wire type is truly a string is fine at the encoder boundary. Public API surfaces that intentionally accept plain strings and brand inside are fine.
