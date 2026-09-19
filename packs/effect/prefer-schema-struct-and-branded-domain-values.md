# Prefer Schema.Struct and branded domain values
globs: `**/*.ts`
globs: `**/*.tsx`

For ordinary Effect v4 records, prefer `Schema.Struct(...)` plus a same-name `interface` over `Schema.Class` / `TaggedClass` as the default. Brand domain primitives (`UserId`, `Email`, …) so same-shaped strings cannot be mixed. Model closed variants as tagged structs/unions (or `Data.TaggedEnum` for internal workflow state) and match exhaustively.

## Not allowed

```
export class User extends Schema.Class<User>('User')({
  id: Schema.String,
  email: Schema.String,
}) {}

function find(userId: string, postId: string) {}
```

## Exceptions

`Schema.Class` is fine when you truly need instance methods/getters on the value. Wire DTOs that intentionally use plain strings before branding at the decode boundary are fine. Non-Effect TypeScript models outside Schema are out of scope for this rule.
