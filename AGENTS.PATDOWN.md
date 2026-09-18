Dogfood rules for patdown. Text above the first heading is ignored.

# No title case
globs: **/*.md

Markdown headings must use sentence case, not title case. Sentence case capitalizes the first word and proper nouns only. Title case capitalizes every principal word.

This is a violation when a heading capitalizes every principal word.

## Not allowed

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
