# Claude Code plugin

`@patdown/claude` (`packages/patdown-claude`) is a Claude Code plugin that judges `Write` and `Edit` against the same fuzzy rules as the CLI, before those tools hit disk.

It is optional and best-effort. Patdown the CLI stays the tree linter for CI and local runs. This plugin exists so you do not have to wait for `pnpm check` / `patdown --files-from` to see a write violation. Claude Code was not available when the first cut was written; validate with `claude plugin validate` before relying on it.

## Scope

Same boundary as [`@patdown/pi`](pi.md): write/edit steering only.

| In | Out |
|---|---|
| `Write` / `Edit` PreToolUse | Bash / `cat >` / `tee` / `sed -i` |
| Reconstruct proposed file, judge in memory | Steer / warn session modes (Pi only for now) |
| `permissionDecision: deny` on FAIL | General agent supervision |

Judge errors are never treated as a pass. Missing `AGENTS.PATDOWN.md` disables judging instead of blocking every write. Rule discovery matches the CLI (including `package.json#patdown.adapter`); only `--adapter` / `--rules` flags are unavailable in the hook.

## Install

Local checkout (no marketplace):

```sh
claude --plugin-dir ./packages/patdown-claude
```

From this repo as a marketplace:

```sh
claude plugin marketplace add ./path/to/patdown
claude plugin install patdown@patdown
```

Also install the CLI packages into the **project being edited**. The Claude plugin cache under `~/.claude/plugins/...` does not ship `patdown`; the hook resolves modules from the project cwd:

```sh
pnpm add -D patdown @patdown/rules
pnpm exec patdown rules
```

Prefer `pnpm exec patdown` over bare `npx patdown`. Requires `TYPESAFE_API_KEY` for the default TypeSafe/Jev judge.

If Claude shows a cached path like `.../plugins/cache/patdown/patdown/0.8.0/...` after a newer release, reinstall or bump the marketplace plugin so `plugin.json` matches the package version.

## Skill

`/patdown:run-patdown` documents on-demand CLI lint (`--files`, `--files-from`, `rules`, `ask`). It does not replace the PreToolUse hook.

## Custom output

The Claude hook always uses the library judge APIs and returns Claude’s deny JSON. It does not take a `PatdownOutput` layer. If you need a different report shape, embed `runPatdownCli` yourself (see [Custom output](../README.md#custom-output)) or extend the hook script.

## Validate

When Claude Code is installed:

```sh
claude plugin validate ./packages/patdown-claude
claude --plugin-dir ./packages/patdown-claude
```

Trigger a deliberate title-case markdown write against a project with the title-case rule and confirm the deny reason quotes the rule.
