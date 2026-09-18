# patdown

Standalone CLI that lints a tree against fuzzy rules in one markdown file. Wrap it as a hook, plugin, or extension.

The judge is [jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev). The cutoff lives in code, not in the model. Noul above 0.85 is yes. Yes on a lint question is a violation.

## Commands

```
pnpm -w patdown
pnpm -w patdown -- --rules ./rules.md
pnpm -w patdown -- rules
pnpm -w patdown -- ask --noul "Is this markdown heading title case?" --state "# Hello World"
```

Default command lints from the current directory. `rules` prints what it loaded. `ask` is a one-shot noul, no files involved.

Walks up from cwd looking for `AGENTS.PATDOWN.md`. `--rules` skips that walk and uses the path you pass.

## Rules

One `# heading` per rule. Optional `globs:` lines sit immediately under the heading. Commas or spaces, extra `globs:` lines stack. Text above the first heading is ignored. Headings inside fenced code are ignored.

```
# No title case
globs: **/*.md

Markdown headings must use sentence case, not title case.
```

No globs means `**/*`. Globs are relative to cwd, not to the rules file. Always skipped: `.git`, `.turbo`, `coverage`, `dist`, `node_modules`.

## Lint

Each matched file goes to Jev as "does this file violate the following patdown rule?" State is `path:` plus the file contents. One file at a time.

A rule with no matches prints `patdown: no files matched ...` and does not fail.

```
patdown: fail No title case README.md (0.91, thresh 0.85)
patdown: ok
```

Exit 1 on a violation, a missing rules file, a read error, or a Jev error.

## Env

`TYPESAFE_API_KEY` is required for lint and `ask`. Optional `TYPESAFE_BASE_URL` (default `https://api.typesafe.ai`) and `TYPESAFE_DEFAULT_MODEL` (default `jev-latest`).

`pnpm -w patdown` forwards `TYPESAFE_*` through Turbo.

Inspired by [pi-warden](https://github.com/DevMortimer/pi-warden). Same idea, inside pi.
