import { baseConfig, subpathImportOverride } from '@squint/oxlint-config/base'
import { defineConfig } from 'oxlint'

export default defineConfig({
	...baseConfig,
	overrides: [...(baseConfig.overrides ?? []), subpathImportOverride],
	options: {
		typeAware: true,
		maxWarnings: 0,
	},
})
