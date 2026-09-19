# Do not copy growing reducer accumulators
globs: `**/*.ts`
globs: `**/*.tsx`

Inside `reduce` / `reduceRight`, do not copy the accumulator on every iteration with `Object.assign({}, acc, …)`, `Array.from(acc)`, `concat`, `slice`, or similar. Mutate a fresh, locally owned accumulator and return it, or use an iterator pipeline / `flatMap`. Pair with static `oxc/no-accumulating-spread` for spread copies.

## Not allowed

```
items.reduce((acc, item) => Object.assign({}, acc, { [item.id]: item }), {})
items.reduce((acc, item) => acc.concat([item]), [])
```

## Exceptions

Mutating a fresh local accumulator (`acc.push(item); return acc`) is fine. Copying individual input items (not the accumulator) is fine. Bounded one-shot copies outside a growing loop are fine when ownership is clear.
