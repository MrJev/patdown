# Do not chain type assertions
globs: `**/*.ts`
globs: `**/*.tsx`

Do not nest or chain `as` / angle-bracket assertions to invent a type the value does not have. One unjustified assertion is already weak; a chain (`as unknown as T`, `as object as T`) is almost always laundering.

## Not allowed

```
const user = input as unknown as User
const value = <Config>(<unknown>raw)
```

## Exceptions

A chain made only of `as const` is fine. A single assertion next to a non-empty `SAFETY:` comment that states a real invariant is fine when the surrounding code establishes that invariant.
