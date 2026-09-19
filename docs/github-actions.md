# GitHub Actions

Use patdown on pull requests as a fuzzy check over **changed files**, not the whole tree. The workflow builds a path list; patdown intersects that list with each rule's globs and judges only the survivors.

## Workflow

Copy [examples/github-actions/patdown.yml](../examples/github-actions/patdown.yml) into a consumer repo. This repository dogfoods the same flow from [`.github/workflows/patdown.yml`](../.github/workflows/patdown.yml) against the built CLI in `apps/patdown/dist`.

Required:

- Secret `TYPESAFE_API_KEY` for the default judge
- `fetch-depth: 0` so the base commit exists
- Run from the repository root (`npx patdown` in consumers; local `node apps/patdown/dist/patdown-cli-bin.js` here). Do not use `pnpm -w patdown`, which changes cwd into `apps/patdown`

Fork pull requests do not receive repository secrets. The example skips those events.

```sh
git diff --name-only --diff-filter=ACMR "$BASE"...HEAD > changed.txt
npx patdown --verbose --files-from changed.txt
```

`--files path` may be repeated. `--files` and `--files-from` may be combined. Blank lines and `#` comments in the list are ignored. Paths outside cwd, and the usual skipped directories (`.git`, `dist`, `node_modules`, …), are dropped. A missing `--files-from` file fails the command. An empty selection after filtering is still `patdown: passed`.

When a path list is set, rules whose globs miss every listed file stay quiet. Without a path list, an empty glob still prints `patdown: no files matched …`.

## Job summary and annotations

When `GITHUB_ACTIONS=true` and `GITHUB_STEP_SUMMARY` are set, the default CLI also:

1. Prints `::error` annotations for failing file/rule pairs (hottest first, capped at 10)
2. Appends a markdown heatmap to the step summary

The summary leads with `patdown passed` or `patdown failed`, then `N passed · M failed · elapsed`. Each heatmap row has a `status` column, and every judged cell starts with `PASS` or `FAIL` before the shade bar.

Stdout stays the normal PASS/FAIL lines and ends with `patdown: passed` or `patdown: failed`. `--verbose` still adds the shade bar, cutoff, and elapsed time. Opt out with `--no-github`.

Embedded callers that pass a custom `PatdownOutput` layer skip this auto-detect. Use `PatdownGitHubActionsOutputLive` if you want the same summary from your own entrypoint.

## Diffs vs files

File lint sends `path:` plus file contents to the judge. That is what the workflow above does.

Piping `git diff` into `ask --stdin` is a separate, optional check. Large diffs can hit the provider token limit; see [jev input limits](jev-input-limits.md). Do not use a diff pipe as a substitute for `--files-from` when the rule needs the whole file.
