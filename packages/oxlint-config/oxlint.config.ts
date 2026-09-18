import { defineConfig } from 'oxlint'

import { baseConfig } from './base.ts'

export default defineConfig({
	...baseConfig,
	overrides: [
		...(baseConfig.overrides ?? []),
		{
			files: ['manifest-plugin.ts', 'oxlint.anti-slop.config.ts'],
			rules: {
				'import/no-default-export': 'off',
			},
		},
	],
	options: {
		typeAware: true,
		maxWarnings: 0,
	},
})
