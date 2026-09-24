---
include: ./packs/typescript
---

Dogfood rules for patdown. Packs load first; local `#` rules follow.

# No title case

globs: **/*.md

Markdown headings must use sentence case, not title case. Sentence case capitalizes the first word and proper nouns only. Title case capitalizes every principal word.

This is a violation when a heading capitalizes every principal word.

## Violations

```
# The Complete Guide To Fuzzy Rules
```

## Exceptions

Acronyms and proper nouns retain their capitalization:

```
# FAQ
# Use the GitHub API
```

# Follow Effect diagnostics

globs: **/*.ts

Use Effect compiler and language-service suggestions to improve the implementation, not just to make the build pass. Address applicable diagnostics instead of silencing them or adding indirection to evade the check.

Clear violations include:

- A zero-argument service method that only returns an Effect when an Effect-valued member would do. Effects are already lazy.
- Synchronous schema decoding inside an Effect workflow when an effectful decoder would preserve the typed error channel.
- Wrapping a yieldable tagged error in `yield* Effect.fail(error)` instead of yielding the error directly.
- Using an unknown-input schema decoder when the input already has the schema's encoded type.
- Suppressing an Effect diagnostic without a specific explanation of why it does not apply.

Only flag patterns visible in the file. Do not infer that a developer ignored diagnostics merely because compiler output is unavailable. Unknown-input decoding at untyped boundaries, such as dynamically imported modules, is appropriate.

# Keep ci-facing cli options wired through the github action

globs: `.patdown-review/cli-action-context.md`

When a change adds or changes a public lint option relevant to
non-interactive ci runs, keep the github action's support in sync.

Trace the option through the complete integration:

- the cli flag definition
- the corresponding input in action.yml
- the run step's environment mapping
- the argument passed by action/run-patdown.sh

A declared input is not sufficient unless its value reaches the cli. Preserve the option's meaning and correctly forward user-supplied values. Document any intentional differences in defaults or behavior.

## Violations

- a new ci-relevant lint option has no equivalent action input.
- an action input is declared but never forwarded to the wrapper.
- the wrapper receives the value but never passes it to the cli.
- a renamed flag leaves the wrapper passing the old name.
- forwarding silently ignores or changes the requested value.

For example, adding --max-judgments to the cli without exposing and forwarding it through the action is incomplete integration.

## Exceptions

- help, version, interactive-only options, and unrelated subcommands.
- an existing action input already provides equivalent functionality.
- a specific omission is intentional and explained in user-facing docs.

## Evidence

Evaluate the supplied diff and complete relevant source files together. A file being absent from the diff is not evidence of missing support. Identify the option and the exact missing or inconsistent connection.
