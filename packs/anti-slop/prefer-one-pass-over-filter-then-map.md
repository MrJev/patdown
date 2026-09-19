# Prefer one pass over filter-then-map
globs: `**/*.ts`
globs: `**/*.tsx`

Do not chain adjacent eager `.filter(…).map(…)` or `.map(…).filter(…)` passes over arrays when a single transformation (or a lazy iterator pipeline) expresses the same work. Prefer `.values().filter(…).map(…).toArray()` where supported, or one `flatMap` / local reducer that preserves callback order and filtering semantics.

## Not allowed

```
const emails = users.filter((u) => u.active).map((u) => u.email)
const found = users.map(lookup).filter((v) => v !== undefined)
```

## Exceptions

Lazy iterator pipelines are fine. Separated filter and map with meaningful work between them are fine. Cases where intermediate arrays are intentional and documented are fine.
