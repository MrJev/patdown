# Pi write steering

`@patdown/pi` is a [pi package](https://pi.dev/packages) that judges Pi `write` and `edit` against the same fuzzy rules the CLI uses.

It is optional. Patdown the CLI stays a tree linter for CI and local runs. The package exists so you do not have to wait for `pnpm check` / `patdown --files-from` to see a rule violation.

## Modes

| Mode | On a violation |
|---|---|
| `block` | Stop the tool. The agent sees the rule in the tool error. Default. |
| `steer` | Let the write happen, then queue a follow-up so the agent can fix it. |
| `warn` | Notify in the TUI only. Do not inject into the conversation. |

Judge errors are never treated as a pass: `block` still blocks; `steer`/`warn` still report the failure.

## When

| When | Hook |
|---|---|
| `before` | `tool_call` — reconstruct the proposed file, judge, optionally block |
| `after` | `tool_result` — read the file that landed, judge, report |
| `both` | both hooks |

`block` always uses `before`. You cannot un-write a file from `tool_result`. Choosing `/patdown block` forces `when: before`. `/patdown steer` and `/patdown warn` default to `after`.

Read-only tools are ignored. Bash is ignored, including `cat > file` / `tee` / `sed -i`. Missing rules disable judging instead of blocking every write.

## Install

```sh
pi install npm:@patdown/pi
```

Project-local:

```sh
pi install -l npm:@patdown/pi
```

From this repo after `pnpm install`:

```sh
pi install ./packages/patdown-pi
pi -e ./packages/patdown-pi
```

Requires Pi 0.85+ and `TYPESAFE_API_KEY`.

## Commands

Type `/patdown ` (with a trailing space) for subcommand suggestions.

```
/patdown
/patdown status
/patdown on
/patdown off
/patdown block
/patdown steer
/patdown warn
/patdown before
/patdown after
/patdown both
```

## package.json

```json
{
  "patdown": {
    "pi": {
      "mode": "steer",
      "when": "after"
    }
  }
}
```

Walks up from cwd. Session `/patdown` commands override for that session only. Adapter and `yesThreshold` stay the CLI keys.

## Not in scope

pi-warden covers stuck loops, secrets, runaway replies, and irreversible bash. This package does not. Use warden for those; use `@patdown/pi` to enforce _your_ markdown rules on the file the agent is writing.
