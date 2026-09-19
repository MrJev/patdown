# Do not pass unknown through function contracts
globs: `**/*.ts`
globs: `**/*.tsx`

Do not use `unknown` (or a Promise of `unknown`, or an alias that only hides `unknown`) as a standing parameter or return contract. Decode unknown input at the I/O boundary into a named type, then pass that type through the rest of the program.

## Not allowed

```
function handle(body: unknown): Promise<unknown> {
  return save(body as User)
}
type Payload = unknown
```

## Exceptions

An explicit `cause: unknown` catch parameter is fine. The exact subject of a user-defined type predicate may be `unknown`. Dynamic import / host JSON boundaries may decode from `unknown` once, then return a named type.
