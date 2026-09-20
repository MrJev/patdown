# @patdown/pi

Pi package that judges `write` and `edit` against the same fuzzy rules as the [patdown](https://github.com/tyler-dot-earth/patdown) CLI, before those tools hit disk.

This is not a general agent supervisor. It does not watch bash, loops, or “done” claims. Failures are steered back to the agent with the broken rule quoted. Judge errors block the write; they are not converted into a pass.

## Install

```sh
pi install npm:@patdown/pi
```

From a checkout after `pnpm install`:

```sh
pi -e ./packages/patdown-pi/src/patdown-pi-extension.ts
```

Needs `TYPESAFE_API_KEY` (same as the CLI). Rules load the same way: walk up from cwd for `AGENTS.PATDOWN.md`, plus package.json adapter / cutoff.

## Commands

```
/patdown
/patdown status
/patdown off
/patdown on
```
