# Address Effect diagnostics instead of dodging them
globs: `**/*.ts`
globs: `**/*.tsx`

Use Effect compiler and language-service suggestions to improve the implementation. Do not silence diagnostics or add indirection that only exists to evade a check.

Clear violations include:

- A zero-argument service method that only returns an Effect when an Effect-valued member would do. Effects are already lazy.
- Synchronous schema decoding inside an Effect workflow when an effectful decoder would preserve the typed error channel.
- Using an unknown-input schema decoder when the input already has the schema's encoded type.
- Suppressing an Effect diagnostic without a specific explanation of why it does not apply.

## Exceptions

Unknown-input decoding at untyped boundaries (dynamic imports, host JSON) is fine. A diagnostic suppression with a comment that names the invariant is fine when that invariant is real.
