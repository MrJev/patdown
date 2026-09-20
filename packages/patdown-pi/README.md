# @patdown/pi

Pi package that judges `write` and `edit` against the same fuzzy rules as the [patdown](https://github.com/tyler-dot-earth/patdown) CLI.

This is not a general agent supervisor. It does not watch bash, loops, or “done” claims. Judge errors are never converted into a pass.

## Modes

- `block` (default) — stop the tool before it hits disk
- `steer` — let it write, then follow up so the agent can fix it
- `warn` — TUI notify only

`/patdown before|after|both` picks the lifecycle hook. `block` always uses `before`.

```sh
pi install npm:@patdown/pi
/patdown steer
```

Needs `TYPESAFE_API_KEY`. See [Pi write steering](../../docs/pi.md).
