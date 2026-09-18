import { defineConfig } from 'vitest/config'

// oxlint-disable-next-line import/no-default-export -- vitest requires default
export default defineConfig({
	resolve: {
		conditions: ['test'],
	},
	ssr: { resolve: { conditions: ['test'] } },
	test: {
		exclude: ['coverage/**', 'dist/**', 'node_modules/**'],
		globals: true,
		include: ['tests/**/*.test.ts'],
		passWithNoTests: false,
	},
})
