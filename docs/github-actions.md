# GitHub Actions

Use patdown on pull requests as a fuzzy check over **changed files**, not the whole tree. The workflow builds a path list; patdown intersects that list with each rule's globs and judges only the survivors.

## Workflow

Copy [examples/github-actions/patdown.yml](../examples/github-actions/patdown.yml) into a consumer repo. This repository dogfoods the same flow from [`.github/workflows/patdown.yml`](../.github/workflows/patdown.yml) against the built CLI in `apps/patdown/dist`.

Required:

- Secret `TYPESAFE_API_KEY` for the default judge
- `fetch-depth: 0` so the base commit exists
- Run from the repository root (`npx patdown` in consumers after a release that includes your flags; in this repo use `pnpm -w patdown -- …`, which builds through Turborepo and keeps the caller cwd)

Fork pull requests do not receive repository secrets. The example skips those events.

```sh
git diff --name-only --diff-filter=ACMR "$BASE"...HEAD > changed.txt
npx patdown --verbose --files-from changed.txt
```

`--files path` may be repeated. Paths may be files, directories, or globs. Directories expand to every file under them (same skipped directories as rule globs). `--files` and `--files-from` may be combined. `--files-from -` reads newline-separated paths from stdin. Blank lines and `#` comments in the list are ignored. Paths outside cwd, and the usual skipped directories (`.git`, `dist`, `node_modules`, …), are dropped. A missing `--files-from` file or missing `--files` path fails the command. An empty selection after filtering is still `patdown: passed`. Before judgments, patdown prints how many selected files and rules it will lint.

When a path list is set, rules whose globs miss every listed file stay quiet. Without a path list, an empty glob still prints `patdown: no files matched …`.

## Job summary and annotations

When `GITHUB_ACTIONS=true` and `GITHUB_STEP_SUMMARY` are set, the default CLI also:

1. Prints workflow-command annotations for failing file/rule pairs (hottest first, capped at 10), including the rule title, globs, and full rule body under the probability line
2. Appends a markdown heatmap to the step summary

Annotation level is display only. It does not change whether a yes judgment fails the run. Levels are `error`, `warning`, and `notice` (GitHub has no `::info`). Resolution, most specific wins:

1. per-rule `github-annotation:` metadata
2. rules-file frontmatter `github-annotation:`
3. `--github-annotation` / package.json `patdown.githubAnnotation`
4. built-in default: `error`

```
---
include:
  - ./node_modules/@patdown/packs/typescript
github-annotation: warning
---

# No title case
globs: **/*.md
github-annotation: error

Markdown headings must use sentence case.
```

```json
{
  "patdown": {
    "githubAnnotation": "warning"
  }
}
```

```sh
npx patdown --github-annotation warning --files-from changed.txt
```

PASS stays one noul judgment. On FAIL, the default TypeSafe judge makes a second Choice call whose candidates are individual lines (full file + original P(yes) in state). Files larger than the per-line cap fall back to chunks. Later we may offer smarter units (functions, headings, hunks) the same way. If that Choice is unavailable, returns `noMatch`, or fails, the annotation still lands on the file at `line=1`.

The summary leads with `patdown passed` or `patdown failed`, then `N passed · M failed · elapsed`. Each heatmap row has a `status` column with ✅ or ❌. Any failed rule marks the whole file row ❌. Judged cells show the shade bar and score; failures append ❌ after the score.

Stdout stays the normal PASS/FAIL lines and ends with `patdown: passed` or `patdown: failed`. `--verbose` still adds the shade bar, cutoff, and elapsed time. Opt out with `--no-github`.

Embedded callers that pass a custom `PatdownOutput` layer skip this auto-detect. Use `PatdownGitHubActionsOutputLive` if you want the same summary from your own entrypoint.

## Diffs vs files

File lint sends `path:` plus file contents to the judge. That is what the workflow above does.

Piping `git diff` into `ask --stdin` is a separate, optional check. Large diffs can hit the provider token limit; see [jev input limits](jev-input-limits.md). Do not use a diff pipe as a substitute for `--files-from` when the rule needs the whole file.
