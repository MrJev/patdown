import { Schema } from 'effect'

/** Choice question body for POST /v1/systemone. Labels map to descriptions. */
export const JevChoiceQuestionSchema = Schema.Struct({
	criteria: Schema.Record(Schema.String, Schema.NullOr(Schema.String)),
	instructions: Schema.optionalKey(Schema.String),
	type: Schema.Literal('choice'),
})

/** Choice answer from POST /v1/systemone. */
export const JevChoiceAnswerSchema = Schema.Struct({
	choice: Schema.String,
	confidence: Schema.Finite,
	probabilities: Schema.Record(Schema.String, Schema.Finite),
	type: Schema.Literal('choice'),
})

/** System One response when every question is choice. */
export const JevChoiceResultSchema = Schema.Struct({
	answers: Schema.Record(Schema.String, JevChoiceAnswerSchema),
	model: Schema.String,
	usage: Schema.Struct({
		input_tokens: Schema.Finite,
		output_tokens: Schema.Finite,
	}),
})

export type JevChoiceAnswer = typeof JevChoiceAnswerSchema.Type

export type JevChoiceResult = typeof JevChoiceResultSchema.Type
