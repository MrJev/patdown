# Rule source adapters

Adapters own rule discovery and parsing. Patdown owns matching target files, calling the configured judge, and reporting violations. You can load YAML, markdown with frontmatter, several files, or an in-memory ruleset. Normalize the result into the same document shape.

## Contract

Two exports work. Pick one.

**Plain loader.** Export `loadPatdownRules(override)`. `override` is the `--rules` string, or `null`. Return the document (or a Promise of it). The adapter file does not import `effect`. Use this when the app is on another Effect major and you do not want a second install just to load rules.

```js
export function loadPatdownRules(override) {
	return {
		patdownRulesFilePath: override ?? 'docs/conventions',
		patdownRules: [
			{
				patdownRuleTitle: 'style/no-title-case',
				patdownRuleBody: 'Headings use sentence case.',
				patdownRuleGlobs: ['**/*.md'],
				patdownRuleYesThreshold: 0.6,
			},
		],
	}
}
```

`@patdown/rules` also exports `patdownPlainRuleSourceLayer` if you want to wrap that function yourself.

**Effect layer.** Export a named `PatdownRuleSourceLive` Layer that provides the `PatdownRuleSource` service from `@patdown/rules`. TypeScript adapters can check their layer with `satisfies PatdownRuleSourceLayer`, imported from `patdown`. The adapter's `effect` import must resolve to the same major the CLI uses (`4.0.0-rc.116` in this release). Do not add that pin to an Effect v3 app root; keep it next to the adapter, or use the plain loader instead.

```ts
loadPatdownRules(
  override: Option.Option<string>,
): Effect.Effect<
  PatdownRulesDocument,
  PatdownRulesFileMissing | PatdownRulesReadFailed | PatdownRulesLoadFailed,
  FileSystem.FileSystem | Path.Path
>
```

`override` contains the raw `--rules` value, or `Option.none()`. Interpret it as a file or directory as appropriate for your source. Relative paths normally resolve from the process cwd.

```ts
type PatdownRulesDocument = {
	readonly patdownRulesFilePath: string
	readonly patdownRules: ReadonlyArray<{
		readonly patdownRuleTitle: string
		readonly patdownRuleBody: string
		readonly patdownRuleGlobs: ReadonlyArray<string>
		readonly patdownRuleYesThreshold?: number
	}>
}
```

`patdownRulesFilePath` is a display label for the whole source. Use the directory for a multi-file source. Markdown frontmatter `include:` (a pack directory or a single rule file) sets optional `patdownRuleSourcePath` on each rule (the file it came from). Adapters may omit that field. Globs always match target files relative to the process cwd, not relative to that label or the adapter. An empty glob list means `**/*`. Omit `patdownRuleYesThreshold` to use the run-level cutoff (`--yes-threshold`, package.json `patdown.yesThreshold`, or 0.85). If present, it must be a finite number in `[0, 1)`.

Layer acquisition may require Effect FileSystem and Path. Patdown supplies both. Provide any additional services inside your layer. Acquisition errors should use `PatdownRulesLoadFailed`. Loading can use the existing missing/read errors or `PatdownRulesLoadFailed` with a parser-specific message.

Imported layers are built in a scope that stays open through `loadPatdownRules`, then closes. Service presence and the returned document are checked at runtime. Missing dependencies, broken service implementations, import failures, and invalid documents fail the command rather than falling back to markdown.

## Selection and resolution

```sh
patdown rules --adapter ./rules-adapter.mjs --rules ./rules
patdown --adapter my-rules-adapter
```

Or configure a project:

```json
{
	"patdown": {
		"adapter": "./rules-adapter.mjs",
		"yesThreshold": 0.9
	}
}
```

- `--adapter` takes precedence and resolves from cwd.
- Discovery walks from cwd toward the filesystem root for the first package.json containing `patdown.adapter`. A nearer package.json without that field does not stop the search.
- Configured relative paths and package names resolve from the directory containing that package.json. Package resolution uses ESM import conditions.
- Missing package.json files are skipped. Unreadable files, invalid JSON, and invalid adapter settings are errors.
- With no adapter configured, the built-in markdown source remains the default.
- Discovery happens only when lint, `rules`, or `doctor` executes. `ask`, `--help`, and `--version` do not import the adapter.

Adapters execute local code with the CLI's permissions. Only run adapters and project configuration you trust. The loader uses native module import, not a sandbox or a TypeScript transpiler. Use `.mjs` or compiled ESM `.js` for portability. Any native TypeScript support depends on your Node version and its restrictions.

## Example: a directory of JSON rules

This example deliberately uses JSON so no parser dependency is needed. Replace the JSON decoder with YAML or frontmatter parsing to support another syntax; the service and returned document stay the same.

Save this as `rules-adapter.mjs` in a project where `effect` and `@patdown/rules` resolve:

```js
import { PatdownRuleSource, PatdownRulesLoadFailed } from '@patdown/rules'
import { Effect, FileSystem, Layer, Option, Path, Schema } from 'effect'

const Rule = Schema.fromJsonString(
	Schema.Struct({
		title: Schema.NonEmptyString,
		body: Schema.NonEmptyString,
		globs: Schema.Array(Schema.String),
	}),
)

export const PatdownRuleSourceLive = Layer.succeed(PatdownRuleSource, {
	loadPatdownRules: (override) =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem
			const path = yield* Path.Path
			const directory = path.resolve(Option.getOrElse(override, () => './rules'))
			const filenames = yield* fs.readDirectory(directory)
			const rules = []

			for (const filename of filenames.filter((name) => name.endsWith('.json')).sort()) {
				const fullPath = path.join(directory, filename)
				const rule = yield* Effect.gen(function* () {
					const text = yield* fs.readFileString(fullPath)
					return yield* Schema.decodeUnknownEffect(Rule)(text)
				}).pipe(
					Effect.mapError(
						(cause) =>
							new PatdownRulesLoadFailed({
								message: `Cannot load rule ${fullPath}: ${String(cause)}`,
							}),
					),
				)
				rules.push({
					patdownRuleTitle: rule.title,
					patdownRuleBody: rule.body,
					patdownRuleGlobs: rule.globs,
				})
			}

			return { patdownRules: rules, patdownRulesFilePath: directory }
		}).pipe(
			Effect.mapError(
				(cause) =>
					new PatdownRulesLoadFailed({
						message: `Rule directory load failed: ${String(cause)}`,
					}),
			),
		),
})
```

A file such as `rules/headings.json`:

```json
{
	"title": "Sentence case headings",
	"body": "Markdown headings use sentence case, preserving proper nouns and acronyms.",
	"globs": ["**/*.md"]
}
```

## Embedded use

Importing `patdown` does not run the executable. The runner returns an Effect, so completion, cancellation, and failures belong to your runtime:

```ts
import { Effect } from 'effect'
import { runPatdownCli } from 'patdown'
import { PatdownRuleSourceLive } from './rules-adapter.mjs'

await Effect.runPromise(runPatdownCli(PatdownRuleSourceLive, ['rules']))
```

Supplying a layer disables discovery, including `--adapter`. Omitting the layer enables discovery. The second argument is CLI arguments without the Node executable and script; by default it uses `process.argv.slice(2)`.

The executable alone calls `NodeRuntime.runMain`. Command handlers still set `process.exitCode` for lint failures and handled loading errors, so embedding does not yet provide a separate structured exit result.

## Doctor

`patdown doctor` loads rules the same way lint, Claude, and Pi do, then prints whether `TYPESAFE_API_KEY` is set **in this process**. It does not call the judge. Exit 1 when the key is missing or, inside a Claude hook, when `CLAUDE_PLUGIN_ROOT`'s `plugin.json` version does not match the installed `patdown` package.

A missing rules file is still a load error here (exit 1). Claude and Pi skip judging in that case, but they print the skip instead of staying silent.

## Current distribution

`patdown` and `@patdown/rules` publish to npm. Effect layer adapters must resolve the same Effect major the CLI pins (`4.0.0-rc.116`). That prerelease is not a stable plugin ABI across majors. A plain `loadPatdownRules` adapter does not import `effect`, so an Effect v3 app can keep v4 out of its root install.

From this repo, `pnpm -w patdown` builds through Turborepo and runs the CLI in the current directory. That cwd is what config discovery and globs use.
