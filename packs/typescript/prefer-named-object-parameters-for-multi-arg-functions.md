# Prefer named object parameters for multi-arg functions
globs: `**/*.ts`
globs: `**/*.tsx`

Exported or cross-module functions with two or more parameters of similar or swappable types should take one named object instead of positional args. Swappable strings, numbers, or ids in adjacent positions are the main violation.

## Not allowed

```
export function sendEmail(subject: string, body: string) {}
```

## Exceptions

Hot numeric kernels, well-known callbacks (`(err, value) => …`), constructors matching a platform API, and single-parameter functions are fine. Methods that already use a destructured object parameter are fine.
