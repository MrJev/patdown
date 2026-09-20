# Pi write steering

`@patdown/pi` is a [pi package](https://pi.dev/packages) that intercepts Pi `write` and `edit` tool calls, reconstructs the proposed file, and runs the same in-memory judge the CLI uses.

It is optional. Patdown the CLI stays a tree linter for CI and local runs. The package exists so you do not have to wait for `pnpm check` / `patdown --files-from` to see a rule violation.

## What it does

1. On session start, load rules the same way the CLI does (`AGENTS.PATDOWN.md` walk, `--rules` equivalent is the default file, package.json adapter / `yesThreshold`).
2. On `write`, judge `content` as the new file.
3. On `edit`, apply exact `oldText` → `newText` replacements against the current file, then judge the result. Overlapping or missing spans are skipped so Pi’s own edit matcher can fail.
4. If any matching rule’s P(yes) is strictly above the cutoff, block the tool and return the rule body to the agent.
5. If the judge call fails, block the tool with that error. Do not treat a failed judgment as a pass.

Read-only tools are ignored. Bash is ignored, including `cat > file` / `tee` / `sed -i` — those still wait for the CLI or CI. Missing rules disable steering instead of blocking every write.

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
pi -e ./packages/patdown-pi/src/patdown-pi-extension.ts
```

Requires Pi 0.85+ and `TYPESAFE_API_KEY`.

## Commands

- `/patdown` / `/patdown status` — footer line with rule count and source path
- `/patdown off` — stop intercepting writes for this session
- `/patdown on` — resume (no-op if rules failed to load)

## Not in scope

pi-warden covers stuck loops, secrets, runaway replies, and irreversible bash. This package does not. Use warden for those; use `@patdown/pi` to enforce _your_ markdown rules on the file the agent is about to write.
