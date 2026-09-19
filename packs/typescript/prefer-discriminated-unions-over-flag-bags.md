# Prefer discriminated unions over flag bags
globs: `**/*.ts`
globs: `**/*.tsx`

Model related states as a tagged union so invalid combinations cannot compile. A single object with several optional fields or booleans that only make sense together is a violation when those fields represent mutually exclusive outcomes.

## Not allowed

```
type LoadState = { loading: boolean; user?: User; error?: string }
```

## Exceptions

Independent optional fields that can all be present at once are fine. Transport DTOs that mirror a wire format before decoding into a union are fine when the next step narrows them.
