# Do not widen then assert

globs: **/_.ts
globs: \**/_.tsx

Do not annotate a known value as a broad type (`unknown`, `any`, `object`, `{}`, or a wide anonymous shape) and later assert it back to a narrower type. Keep the precise type from initialization through use, or parse once at the boundary into the narrow type.

## Not allowed

```
const value: unknown = getConfig()
const port = (value as Config).port
```

```
const row = { id: userId } as Record<string, unknown>
const id = row.id as UserId
```

## Exceptions

A single decode step from `unknown` through Schema (or another parser) into a named type is fine. Interop with a library that requires `unknown` at its boundary is fine when you decode immediately.

# Do not silence anti-slop with type laundering

globs: **/_.ts
globs: \**/_.tsx

Do not rewrite code solely to evade a linter or type rule while preserving the same unsafe hole: renaming `any` to `unknown` then casting, replacing `as T` with `as unknown as T`, or introducing a local alias whose only purpose is to reintroduce `any`/`object`/`Record<string, unknown>` under another name. The judge should flag intent to launder, not creative spelling.

## Not allowed

```
type Loose = any
function f(x: Loose) { return x as User }
```

```
const data = payload as unknown as User
```

## Exceptions

A genuine refactor that introduces a named owner type and validates into it is fine. Schema brands and `satisfies` that keep evidence are fine.

# Prefer named owner types over escape-hatch dictionaries

globs: **/_.ts
globs: \**/_.tsx

Do not use `Record<string, unknown>`, `Record<string, any>`, or `{ [key: string]: object }` as a standing contract for application data. Prefer a named schema/type for the closed set of fields you actually read.

## Not allowed

```
function handle(body: Record<string, unknown>) {
  return body['email'] as string
}
```

## Exceptions

Open-ended user metadata bags that are only stored and returned opaque are fine when callers never dig fields out via cast. JSON AST types in parsers are fine.

# Do not hide omission behind empty-object spreads

globs: **/_.ts
globs: \**/_.tsx

Do not use conditional empty-object spreads to pretend a property was always part of the object when the honest model is "property present or absent". Prefer building the object in branches or using optional fields explicitly.

## Not allowed

```
return {
  id,
  ...(name === undefined ? {} : { name }),
}
```

## Exceptions

Merging option bags from a library that documents empty-object spreads as the API is fine. Spreading a real partial object (`...options`) is fine.
