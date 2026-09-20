import { Result, Schema } from 'effect'

const PatdownToolResultPathSchema = Schema.fromJsonString(
	Schema.Struct({
		path: Schema.String,
	}),
)

/** Parse a write/edit tool_result JSON payload for the path that landed. */
export function decodePatdownToolResultPath(json: string): string | null {
	const decoded = Schema.decodeResult(PatdownToolResultPathSchema)(json)

	if (Result.isFailure(decoded)) return null

	return decoded.success.path
}
