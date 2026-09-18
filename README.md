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

## Adapters

The default rule source parses markdown. Swap it with a module that exports `PatdownRuleSourceLive`, an Effect Layer for `PatdownRuleSource`.

```
pnpm -w patdown -- --adapter ./patdown-yaml-rules.js
```

Or in the nearest `package.json` walking up from cwd:

```
{
  "patdown": {
    "adapter": "./patdown-yaml-rules.js"
  }
}
```

`--adapter` wins over package.json. `--rules` is still passed to the adapter as an override path.

```
import { PatdownRuleSource } from '@patdown/rules'
import { Effect, Layer } from 'effect'

export const PatdownRuleSourceLive = Layer.succeed(PatdownRuleSource, {
  loadPatdownRules: () =>
    Effect.succeed({
      patdownRules: [
        {
          patdownRuleTitle: 'No title case',
          patdownRuleBody: 'Headings use sentence case.',
          patdownRuleGlobs: ['**/*.md'],
        },
      ],
      patdownRulesFilePath: 'yaml-rules',
    }),
})
```

Load files however you want inside `loadPatdownRules`. `@patdown/rules` exports `findPatdownRulesFilePath` if you still want to walk up for a filename.

If you wrap the CLI as a hook and already have a layer, skip discovery:

```
import { Effect } from 'effect'
import { runPatdownCli } from '@patdown/cli'

await Effect.runPromise(runPatdownCli(PatdownRuleSourceLive))
```

See [the adapter guide](docs/rule-source-adapters.md) for the interface, a multi-file parser, resolution rules, resource lifetimes, and local development setup. Adapters execute trusted local code. The packages are not yet published to npm.

## Rules

One `# heading` per rule. Optional `globs:` lines sit immediately under the heading. Commas or spaces, extra `globs:` lines stack. Text above the first heading is ignored. Headings inside fenced code are ignored. Only `#` headings start rules; `##` and deeper headings stay in the rule body, so sections like `## Not allowed` and `## Exceptions` are fine.

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
patdown: failed
```

Exit 1 on a violation, a missing rules file, a read error, or a Jev error.

## Env

`TYPESAFE_API_KEY` is required for lint and `ask`. Optional `TYPESAFE_BASE_URL` (default `https://api.typesafe.ai`) and `TYPESAFE_DEFAULT_MODEL` (default `jev-latest`).

`pnpm -w patdown` forwards `TYPESAFE_*` through Turbo.

## Release

Version lives in `apps/patdown/package.json`. That is what `patdown --version` prints.

```
pnpm -w release patch
pnpm -w release minor
pnpm -w release major
```

Needs a clean tree. Runs `pnpm check`, bumps that version, commits, tags `vX.Y.Z`, and pushes to `github` (and `gitea` if that remote exists). Then watches the GitHub Action.

The tag workflow runs check again and opens a GitHub Release with generated notes. No npm publish.

Pull requests and pushes to `main` run `pnpm check`. That is oxlint, tests, and typecheck. Not the fuzzy linter.

## Related

Inspired by [pi-warden](https://github.com/DevMortimer/pi-warden). Same idea, inside pi.

Name inspired by It's Always Sunny in Philadelphia

<img width="511" height="415" alt="image" src="https://github.com/user-attachments/assets/f7c73138-3914-4fbd-9e6b-7a37d161334a" />
