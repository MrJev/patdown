# Judge providers

`PatdownJudge` is the provider-neutral Effect service used by `ask` and lint. It estimates whether a question is true of some text:

```ts
ask(question: string, text: string): Effect.Effect<
  { readonly yesProbability: number },
  PatdownJudgeFailed
>
```

The probability must be finite and between 0 and 1. Patdown validates responses before printing or applying its decision policy. It is always the probability of **yes**, not confidence in the selected answer. A value of 0.02 indicates strong support for no.

Providers estimate; patdown decides. The shared cutoff is strictly `> 0.85`. In lint, yes means a rule violation. Default output hides the probability. `--verbose` exposes it without provider terminology.

## Supply a provider

The third argument to `runPatdownCli` accepts a judge Layer. Provide transport, credentials, and other dependencies inside that layer. Its acquisition may fail with `PatdownJudgeFailed`; its service methods use the same error type.

```ts
import { Effect, Layer } from 'effect'
import { PatdownJudge, runPatdownCli } from '@patdown/cli'

// Fixed output for a local test. A real provider calls its own backend here.
const TestJudgeLive = Layer.succeed(PatdownJudge, {
	ask: (_question, _text) => Effect.succeed({ yesProbability: 0.9 }),
})

await Effect.runPromise(
	runPatdownCli(
		undefined, // keep normal rule-source discovery
		['ask', 'Is this urgent?', '--input-text', 'ASAP'],
		TestJudgeLive,
	),
)
```

This custom provider needs no TypeSafe API key. Rule-source adapters and judge providers are separate services. The CLI does not yet discover judge modules through a flag or package.json; use an embedded entrypoint to replace the judge.

The packages remain private and unpublished. As with rule-source adapters, examples assume a built local workspace and matching Effect versions.

## Default backend and future migration

`TypeSafeJudgeLive` currently translates the private TypeSafe client's response into `yesProbability`. Its wire-format terminology stays inside that adapter/client. TypeSafe environment variables only configure this backend.

[Issue #1](https://github.com/tyler-dot-earth/patdown/issues/1) tracks the upcoming Effect `Decision` and `DecisionModel` modules. Once those APIs are available, replace this backend layer with an implementation using them. We do not assume an unreleased API signature or expose it through the CLI today. The service contract, rule sources, output, and cutoff remain independent of that migration.
