# Do not hide omission behind empty-object spreads
globs: `**/*.ts`
globs: `**/*.tsx`

Do not use conditional empty-object spreads to pretend a property was always part of the object when the honest model is “property present or absent”. Prefer building the object in branches or using optional fields explicitly. Omission is not the same as assigning `undefined`.

## Not allowed

```
return {
  id,
  ...(name === undefined ? {} : { name }),
}
```

## Exceptions

Merging option bags from a library that documents empty-object spreads as the API is fine. Spreading a real partial object (`...options`) is fine.
