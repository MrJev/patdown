# Prefer Stream for multi-value effectful sources
globs: `**/*.ts`
globs: `**/*.tsx`

Prefer `Stream` (and Queue/PubSub-backed streams) for effectful sources that emit many values over time and need pull, backpressure, interruption, or transformation—SSE, uploads, logs, model tokens, pagination—rather than ad-hoc async iterators glued with bare Promises.

## Not allowed

```
async function* pages() {
  while (true) {
    const batch = await fetchPage()
    if (batch.length === 0) return
    yield batch
  }
}
```

## Exceptions

Single-shot Effects that return one array are fine. Node streams bridged once at an adapter boundary into `Stream` are fine.
