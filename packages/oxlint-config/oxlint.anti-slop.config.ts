import { defineConfig } from 'oxlint'

/** Isolated lint path for the vendored anti-slop plugin. Does not load anti-slop rules onto itself. */
export default defineConfig({
	plugins: ['typescript', 'oxc'],
	rules: {
		'typescript/no-explicit-any': 'error',
		'typescript/no-unnecessary-type-conversion': 'error',
		'typescript/no-unnecessary-type-parameters': 'error',
		'typescript/no-unsafe-argument': 'error',
		'typescript/no-unsafe-assignment': 'error',
		'typescript/no-unsafe-call': 'error',
		'typescript/no-unsafe-member-access': 'error',
		'typescript/no-unsafe-return': 'error',
	},
	ignorePatterns: ['**/node_modules/**', '**/dist/**'],
	options: {
		typeAware: true,
		maxWarnings: 0,
	},
})
