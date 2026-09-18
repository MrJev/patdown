import { baseConfig } from '@patdown/oxlint-config/base'
import { defineConfig } from 'oxlint'

export default defineConfig({
	...baseConfig,
	options: {
		typeAware: true,
		maxWarnings: 0,
	},
})
