# Require a SAFETY comment for type assertions
globs: `**/*.ts`
globs: `**/*.tsx`

Every non-`const` type assertion needs a nearby comment that states the invariant being trusted (default marker `SAFETY:`). An assertion without that justification is a violation—especially when the cast is the only thing making the types line up.

## Not allowed

```
const user = body as User
```

## Exceptions

`as const` is fine. A nearby `SAFETY: …` (or project-configured marker) that names a real invariant is fine. Test fixtures may cast when the fake's incomplete object is intentional and commented.
