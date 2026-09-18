import { setTimeout } from 'node:timers/promises'

// Live, potentially billable diagnostic. Never run this from CI or ordinary tests.
const args = process.argv.slice(2)

if (!args.includes('--live')) {
	console.error(
		'Usage: node scripts/probe-jev-input-size.mjs --live [--spaces] <bytes> ...\nSends synthetic input directly to api.typesafe.ai using TYPESAFE_API_KEY. May incur charges. Stops on first failure; no retries.',
	)
	process.exit(1)
}

const sizes = args.filter((arg) => arg !== '--live' && arg !== '--spaces').map(Number)

if (
	sizes.length === 0 ||
	sizes.length > 16 ||
	sizes.some((size) => !Number.isSafeInteger(size) || size < 1 || size > 262144)
) {
	throw new Error('Supply 1–16 input sizes, each between 1 and 262144 bytes')
}

if (!process.env.TYPESAFE_API_KEY) throw new Error('TYPESAFE_API_KEY is required')

const endpoint = 'https://api.typesafe.ai/v1/systemone'
const model = process.env.TYPESAFE_DEFAULT_MODEL ?? 'jev-latest'
const inputKind = args.includes('--spaces') ? 'spaces' : 'diff'

for (const inputBytes of sizes) {
	let state =
		'diff --git a/example.ts b/example.ts\n--- a/example.ts\n+++ b/example.ts\n@@ -0,0 +1,999 @@\n'

	for (let index = 0; state.length < inputBytes; index += 1) {
		state += `+export const example${index} = { label: "synthetic item ${index}", enabled: true };\n`
	}

	state = inputKind === 'spaces' ? ' '.repeat(inputBytes) : state.slice(0, inputBytes)

	const body = JSON.stringify({
		model,
		questions: {
			noul: {
				criteria: {
					false: 'No. The state does not match, or there is not enough evidence.',
					true: 'Yes. The state clearly matches the question.',
				},
				instructions: 'Does this diff add console.log debugging statements?',
				type: 'noul',
			},
		},
		state,
	})
	const started = Date.now()
	const metadata = {
		at: new Date().toISOString(),
		endpoint,
		model,
		inputKind,
		inputBytes,
		requestBytes: Buffer.byteLength(body),
	}

	try {
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'authorization': `Bearer ${process.env.TYPESAFE_API_KEY}`,
				'content-type': 'application/json',
				'accept': 'application/json',
			},
			body,
			signal: AbortSignal.timeout(60000),
		})
		const result = await response.json().catch(() => null)

		console.log(
			JSON.stringify({
				...metadata,
				status: response.status,
				elapsedMs: Date.now() - started,
				requestId: response.headers.get('x-typesafe-request-id'),
				resolvedModel: result?.model,
				usage: result?.usage,
				providerErrorCode: result?.detail?.error_type,
				yesProbability: result?.answers?.noul?.noul,
			}),
		)

		if (!response.ok || typeof result?.answers?.noul?.noul !== 'number') {
			process.exitCode = 1
			break
		}
	} catch (error) {
		console.log(
			JSON.stringify({
				...metadata,
				elapsedMs: Date.now() - started,
				errorName: error.name,
				error: 'Transport or local timeout failure; not proof of a size limit',
			}),
		)
		process.exitCode = 1
		break
	}

	await setTimeout(1000)
}
