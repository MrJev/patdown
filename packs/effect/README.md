# effect pack

Effect **v4** production defaults for services, schemas, errors, time, HTTP, and tests.

Sources (Effect **v4** only; do not copy Effect v2/v3 blog patterns):

- [effect.solutions](https://www.effect.solutions/) — field manual (Basics, Services & Layers, Error Handling, …)
- [Kit Langton's Effect skill](https://github.com/kitlangton/skills/tree/main/skills/effect) — branch references (schema, services, config, schedule, cache, stream, HTTP, tests)
- [OpenCode Effect skill (`beta`)](https://github.com/anomalyco/opencode/blob/beta/.opencode/skills/effect/SKILL.md) — short v4 house style from an actively developed Effect-heavy agent codebase ([repo](https://github.com/anomalyco/opencode/tree/beta); their docs also treat `v2` as the default integration branch)
- Optional Oxlint [anti-slop-effect](https://github.com/dmmulroy/anti-slop) group for `_tag` / Match / service-constructor policy

**Modeling default here:** `Schema.Struct` + same-name `interface`, and `Schema.TaggedErrorClass` for errors. Prefer that over `Schema.Class` / `TaggedClass` as the everyday record style (effect.solutions demos Class in places; treat that as optional when you need instance methods, not the pack default).

## Rules

| Rule | Theme |
|---|---|
| [Prefer Effect for uncertain IO and boundaries](prefer-effect-for-uncertain-io-and-boundaries.md) | When to use Effect |
| [Use Context.Service and Layer instead of hidden singletons](use-context-service-and-layer-instead-of-hidden-singletons.md) | DI / config |
| [Prefer Effect.fn for named effectful work](prefer-effect-fn-for-named-effectful-work.md) | Basics / tracing |
| [Keep service method requirements empty](keep-service-method-requirements-empty.md) | Services & Layers |
| [Prefer Schema.Struct and branded domain values](prefer-schema-struct-and-branded-domain-values.md) | Data modeling |
| [Prefer Schema and tagged errors at Effect boundaries](prefer-schema-and-tagged-errors-at-effect-boundaries.md) | Decode + errors |
| [Yield tagged errors and recover with catchTag](yield-tagged-errors-and-recover-with-catchtag.md) | Error handling |
| [Prefer Match over manual tag branching](prefer-match-over-manual-tag-branching.md) | Variants / anti-slop-effect |
| [Prefer Schedule and TestClock over Date and sleep](prefer-schedule-and-testclock-over-date-and-sleep.md) | Time / retries |
| [Prefer Effect HttpClient for outgoing HTTP](prefer-effect-httpclient-for-outgoing-http.md) | HTTP |
| [Prefer effect Cache over hand-rolled maps](prefer-effect-cache-over-hand-rolled-maps.md) | Caching |
| [Prefer Stream for multi-value effectful sources](prefer-stream-for-multi-value-effectful-sources.md) | Streams |
| [Prefer Effect-aware tests and layers](prefer-effect-aware-tests-and-layers.md) | Testing |
| [Address Effect diagnostics instead of dodging them](address-effect-diagnostics-instead-of-dodging-them.md) | Language service |

## Use

```sh
npx patdown --rules ./node_modules/@patdown/packs/effect --files-from changed.txt --verbose
```
