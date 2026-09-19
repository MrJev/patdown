# Prefer named owner types over escape-hatch dictionaries
globs: `**/*.ts`
globs: `**/*.tsx`

Do not use `Record<string, unknown>`, `Record<string, any>`, `{ [key: string]: object }`, bare `object`, or similar escape-hatch dictionaries as a standing contract for application data or function inputs. Prefer a named schema/type for the closed set of fields you actually read, and parse at the boundary.

## Not allowed

```
function handle(body: Record<string, unknown>) {
  return body['email'] as string
}
function take(value: object) {}
```

## Exceptions

Open-ended user metadata that is only stored and returned opaque is fine when callers never dig fields out via cast. Generic constraints such as `T extends Record<string, unknown>` are fine. JSON AST types in parsers are fine.
