# Prefer named owner types over escape-hatch dictionaries
globs: `**/*.ts`
globs: `**/*.tsx`

Do not use `Record<string, unknown>`, `Record<string, any>`, or `{ [key: string]: object }` as a standing contract for application data. Prefer a named schema/type for the closed set of fields you actually read.

## Not allowed

```
function handle(body: Record<string, unknown>) {
  return body['email'] as string
}
```

## Exceptions

Open-ended user metadata bags that are only stored and returned opaque are fine when callers never dig fields out via cast. JSON AST types in parsers are fine.
