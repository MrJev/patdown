# squint

Standalone CLI that lints a tree against fuzzy rules in one markdown file.

[pi-warden](https://github.com/DevMortimer/pi-warden) does this inside pi. That's the trap. This is the same job as a CLI you can wrap as a hook, plugin, or extension.

The agent is [jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev) by default. Swap it if you want.

Rules live in `AGENTS.SQUINT.md`. One `# heading` per rule. Optional `globs:` line under the heading. Text above the first heading is ignored.

```
pnpm -w squint
pnpm -w squint -- rules
pnpm -w squint -- ask --noul "Is this markdown heading title case?" --state "# Hello World"
```

Lint and `ask` call TypeSafe System One with `TYPESAFE_API_KEY`. A noul above 0.85 is yes. Lint treats yes as a rule violation.
