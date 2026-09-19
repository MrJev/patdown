# Do not put shape in symbol names
globs: `**/*.ts`
globs: `**/*.tsx`

Do not use the substring `shape` (any casing) in names you own—variables, functions, types, private fields, JSX identifiers. Prefer domain words (`fields`, `schema`, `layout`, `form`). Static member access on third-party APIs you cannot rename (for example Zod's `.shape`) is fine.

## Not allowed

```
type UserShape = { id: string }
function getShape(input: Form) {}
const formShape = input
```

## Exceptions

Reading `schema.shape` (or similar) from a library API you do not control is fine. Comments and strings are out of scope for this fuzzy rule unless they rename a symbol.
