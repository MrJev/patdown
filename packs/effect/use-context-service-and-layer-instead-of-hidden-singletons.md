# Use Context.Service and Layer instead of hidden singletons
globs: `**/*.ts`
globs: `**/*.tsx`

Application dependencies that call networks, disks, clocks, or process env should be `Context.Service` values provided by `Layer`, not module-level mutable singletons or direct `process.env` reads in business logic. Reading config through `Config` / `ConfigProvider` inside a layer is required when the value varies by environment.

## Not allowed

```
export const db = new Pool(process.env.DATABASE_URL)
export function getUser(id: string) { return db.query(id) }
```

## Exceptions

Process entrypoints may read env while building layers. True constants (literal URLs for public docs, fixed algorithm names) may stay as module constants. Scripts and one-off tools are fine.
