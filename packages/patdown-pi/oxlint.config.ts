import { baseConfig, subpathImportOverride } from '@patdown/oxlint-config/base'
import { defineConfig } from 'oxlint'

export default defineConfig({
	...baseConfig,
	overrides: [
		...(baseConfig.overrides ?? []),
		subpathImportOverride,
		{
			files: ['src/patdown-pi-extension.ts'],
			rules: {
				'import/no-default-export': 'off',
				'unicorn/no-useless-undefined': 'off',
			},
		},
	],
	options: {
		typeAware: true,
		maxWarnings: 0,
	},
})
