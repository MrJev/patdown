# @patdown/claude

Claude Code plugin that judges `Write` / `Edit` against the same fuzzy rules as the [patdown](https://github.com/tyler-dot-earth/patdown) CLI.

This is a best-effort first cut (Claude Code was not available when it was written). Scope matches `@patdown/pi`: write/edit steering only. Bash, loops, and “done” checks are out of scope. Judge errors are never converted into a pass.

## What it does

- **PreToolUse hook** on `Write|Edit`: reconstruct the proposed file, load `AGENTS.PATDOWN.md` (with frontmatter includes), judge in memory, `permissionDecision: deny` on FAIL
- **Skill** `/patdown:run-patdown`: how to run the CLI on demand for tree lint

Missing rules disable judging instead of blocking every write. Paths outside cwd and the usual skips (`node_modules`, `dist`, …) are ignored.

## Install (local checkout)

With Claude Code available:

```sh
claude --plugin-dir ./packages/patdown-claude
# or after packaging a marketplace later:
# /plugin marketplace add tyler-dot-earth/patdown
# /plugin install patdown@patdown
```

Also install the CLI deps the hook and skill import (do not rely on bare `npx patdown`):

```sh
pnpm add -D patdown @patdown/rules
pnpm exec patdown rules
```

Needs `TYPESAFE_API_KEY` for the default judge.

## Layout

```
packages/patdown-claude/
├── .claude-plugin/plugin.json
├── hooks/hooks.json
├── hooks/judge-write-edit.mjs
├── hooks/proposed-file.mjs
└── skills/run-patdown/SKILL.md
```

Only `plugin.json` lives under `.claude-plugin/`. Hooks and skills stay at the plugin root.

## Limits vs @patdown/pi

| | Claude plugin | `@patdown/pi` |
|---|---|---|
| Default | block before write | block before write |
| Steer / warn modes | not yet | `/patdown steer\|warn` |
| Session commands | not yet | `/patdown on\|off\|…` |
| Bash writes | ignored | ignored |

If you need steer/warn or session toggles, start from Pi or extend this plugin once Claude Code is available for validation (`claude plugin validate ./packages/patdown-claude`).

## Marketplace

This repo also ships `.claude-plugin/marketplace.json` so the plugin can be added from the checkout:

```sh
claude plugin marketplace add ./path/to/patdown
claude plugin install patdown@patdown
```

Publishing to Anthropic’s community marketplace is optional and separate from npm.
