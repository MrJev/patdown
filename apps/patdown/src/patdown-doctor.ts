import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

import {
	PatdownRuleSource,
	PatdownRulesLoadFailed,
	PatdownYesThresholdInvalid,
	type PatdownRulesDocument,
} from '@patdown/rules'
import { Config, Effect, FileSystem, Option, Path, Result, Schema } from 'effect'

import { loadConfiguredPatdownRules } from '#src/patdown-rule-source-adapter'
import { resolvePatdownYesThreshold } from '#src/patdown-yes-threshold-config'

/** One check printed by `patdown doctor`. `ok: false` is a problem, not a skip. */
export type PatdownDoctorCheck = {
	readonly label: string
	readonly detail: string
	readonly ok: boolean
}

/** Result of loading rules and checking the judge key, without calling the judge. */
export type PatdownDoctorReport = {
	readonly checks: ReadonlyArray<PatdownDoctorCheck>
	readonly failed: boolean
}

const ClaudePluginJsonSchema = Schema.Struct({
	version: Schema.NonEmptyString,
})

function doctorCheck(label: string, detail: string, ok: boolean): PatdownDoctorCheck {
	return { label, detail, ok }
}

function optionalEnv(name: string): Effect.Effect<Option.Option<string>> {
	return Config.String(name).pipe(
		Config.option,
		Effect.orElseSucceed(() => Option.none()),
	)
}

function rulesCheck(document: PatdownRulesDocument): PatdownDoctorCheck {
	const count = document.patdownRules.length
	const label = count === 1 ? '1 rule' : `${String(count)} rules`

	return doctorCheck('rules', `${label} from ${document.patdownRulesFilePath}`, true)
}

function typeSafeKeyCheck(key: Option.Option<string>): PatdownDoctorCheck {
	if (Option.isNone(key) || key.value.trim().length === 0) {
		return doctorCheck(
			'TYPESAFE_API_KEY',
			'missing in this process (Claude/Pi hooks use their own env, not a neighboring shell)',
			false,
		)
	}

	return doctorCheck('TYPESAFE_API_KEY', 'set in this process', true)
}

type ClaudePluginVersion = {
	readonly kind: 'version'
	readonly version: string
}

function isClaudePluginVersion(
	value: ClaudePluginVersion | PatdownDoctorCheck,
): value is ClaudePluginVersion {
	return 'kind' in value
}

function readClaudePluginVersion(pluginRoot: string): ClaudePluginVersion | PatdownDoctorCheck {
	const pluginJsonPath = join(pluginRoot, '.claude-plugin', 'plugin.json')

	try {
		const require = createRequire(import.meta.url)
		const resolved = require.resolve(pluginJsonPath)
		const pluginJson = readFileSync(resolved, 'utf8')

		const decoded = Schema.decodeResult(Schema.fromJsonString(ClaudePluginJsonSchema))(pluginJson)

		if (Result.isFailure(decoded)) {
			return doctorCheck('claude plugin', `no version in ${resolved}`, false)
		}

		return { kind: 'version', version: decoded.success.version }
	} catch (cause) {
		const detail = cause instanceof Error ? cause.message : String(cause)

		return doctorCheck(
			'claude plugin',
			`cannot read plugin.json under ${pluginRoot}: ${detail}`,
			false,
		)
	}
}

function claudePluginVersionCheck(
	cliVersion: string,
	pluginRoot: Option.Option<string>,
): PatdownDoctorCheck {
	if (Option.isNone(pluginRoot) || pluginRoot.value.length === 0) {
		return doctorCheck(
			'claude plugin',
			'CLAUDE_PLUGIN_ROOT unset (expected outside the Claude hook process)',
			true,
		)
	}

	const version = readClaudePluginVersion(pluginRoot.value)

	if (!isClaudePluginVersion(version)) return version

	if (version.version !== cliVersion) {
		return doctorCheck(
			'claude plugin',
			`cache ${version.version} does not match installed patdown ${cliVersion}; reinstall the plugin`,
			false,
		)
	}

	return doctorCheck('claude plugin', `cache ${version.version} matches installed patdown`, true)
}

/**
 * Loads rules the same way lint, Claude, and Pi do, then reports key and plugin version. Does not
 * call the judge.
 */
export function runPatdownDoctor(
	cliVersion: string,
): Effect.Effect<
	PatdownDoctorReport,
	PatdownRulesLoadFailed | PatdownYesThresholdInvalid,
	PatdownRuleSource | FileSystem.FileSystem | Path.Path
> {
	return Effect.gen(function* () {
		const document = yield* loadConfiguredPatdownRules(Option.none(), Option.none())
		const cutoff = yield* resolvePatdownYesThreshold(Option.none())
		const key = yield* optionalEnv('TYPESAFE_API_KEY')
		const pluginRoot = yield* optionalEnv('CLAUDE_PLUGIN_ROOT')

		const checks = [
			rulesCheck(document),
			doctorCheck(
				'yes-threshold',
				`default cutoff >${String(cutoff)} (per-rule frontmatter can override)`,
				true,
			),
			typeSafeKeyCheck(key),
			claudePluginVersionCheck(cliVersion, pluginRoot),
		]

		return { checks, failed: checks.some((check) => !check.ok) }
	})
}

/** One line per check. Failed checks start with `patdown doctor:`. */
export function formatPatdownDoctorReport(report: PatdownDoctorReport): string {
	return report.checks
		.map((check) => {
			const mark = check.ok ? 'ok' : 'fail'

			return `patdown doctor: ${mark} ${check.label}: ${check.detail}`
		})
		.join('\n')
}
