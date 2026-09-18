# @squint/tsconfig

Shared TypeScript presets for this repo.

## Presets

- `base.json`: strictness and correctness defaults shared by all TS packages.
- `node-library.json`: Node.js library defaults layered on top of `base.json`.

## Option rationale

### Strictness

- `strict`: enables TypeScript's strict mode family of checks.
- `exactOptionalPropertyTypes`: treats `foo?: T` as "property may be absent" instead of implicitly allowing `undefined` assignments.
- `noUncheckedIndexedAccess`: adds `undefined` to values read through unchecked index access.
- `noPropertyAccessFromIndexSignature`: forces bracket access for index-signature properties so uncertain lookups are more explicit.
- `noImplicitOverride`: requires `override` on subclass members that override a base member.
- `noImplicitReturns`: requires every code path in a function to return when a return type is expected.
- `noFallthroughCasesInSwitch`: catches accidental switch fallthrough.
- `noUnusedLocals`: reports locals that are declared but never read.
- `noUnusedParameters`: reports function parameters that are declared but never used.

### Correctness and reliability

- `noUncheckedSideEffectImports`: errors on side-effect imports that do not resolve to a real module.
- `forceConsistentCasingInFileNames`: prevents import casing mismatches that break on case-sensitive filesystems.
- `skipLibCheck: false`: type-checks declaration files instead of trusting dependency typings blindly.

### Modern TS and ESM behavior

- `allowImportingTsExtensions: false`: rejects direct `.ts` and `.tsx` specifiers in source imports.
- `verbatimModuleSyntax`: preserves import/export syntax and makes type-only imports explicit.
- `rewriteRelativeImportExtensions`: rewrites relative TS import extensions during emit for runtime-correct JS output.
- `erasableSyntaxOnly`: restricts code to syntax that can be erased cleanly by TypeScript.
- `moduleDetection: "force"`: treats files as modules consistently instead of falling back to script-mode behavior.

### Node library defaults

- `target: "ES2025"`: pins a modern JS target instead of floating on `ESNext`.
- `lib: ["ES2025"]`: matches the pinned runtime surface area.
- `module: "NodeNext"`: uses Node's modern ESM/CJS-aware module behavior.
- `types: ["node"]`: explicitly opts into Node globals and module typings.
- `isolatedModules`: ensures each file can be transpiled safely in isolation.

## Intentionally not included here

- `noEmit`: package-level dev configs should decide whether they emit.
- `declaration`, `declarationMap`, `isolatedDeclarations`: build configs should own declaration emit behavior.
- `rootDir`, `outDir`, `include`, `exclude`: these are package-specific.

## Usage

Example package config:

```json
{
	"extends": "@squint/tsconfig/node-library.json",
	"compilerOptions": {
		"noEmit": true
	},
	"exclude": ["dist"]
}
```

Example build config:

```json
{
	"extends": "./tsconfig.json",
	"compilerOptions": {
		"noEmit": false,
		"rootDir": "./src",
		"outDir": "./dist",
		"declaration": true,
		"declarationMap": true,
		"isolatedDeclarations": true
	},
	"include": ["src/**/*.ts"]
}
```
