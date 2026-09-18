import { Schema } from 'effect'

/** Noul question body for POST /v1/systemone. */
export const JevNoulQuestionSchema = Schema.Struct({
	criteria: Schema.optionalKey(
		Schema.Struct({
			false: Schema.optionalKey(Schema.String),
			true: Schema.optionalKey(Schema.String),
		}),
	),
	instructions: Schema.optionalKey(Schema.String),
	type: Schema.Literal('noul'),
})

/** Noul answer from POST /v1/systemone. */
export const JevNoulAnswerSchema = Schema.Struct({
	noul: Schema.Finite,
	type: Schema.Literal('noul'),
})

/** Token usage reported by System One. */
export const JevUsageSchema = Schema.Struct({
	input_tokens: Schema.Finite,
	output_tokens: Schema.Finite,
})

/** System One response when every question is noul. */
export const JevNoulResultSchema = Schema.Struct({
	answers: Schema.Record(Schema.String, JevNoulAnswerSchema),
	model: Schema.String,
	usage: JevUsageSchema,
})

export type JevNoulAnswer = typeof JevNoulAnswerSchema.Type

export type JevNoulResult = typeof JevNoulResultSchema.Type
