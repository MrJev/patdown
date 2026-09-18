import { Schema } from 'effect'

import { asAstNode, asAstNodeArray, decodedOption, type AstNode } from './json-decode.ts'

export interface UnconstrainedInputGenericDiagnostic {
	message: string
	node: AstNode
}

const diagnosticMessage =
	'Do not replace `unknown` with an unconstrained generic. Keep honest `unknown` at a first-decoder edge, or use a named Encoded type when the host already supplies that evidence.'

function visitChildNodes(node: AstNode, visitor: (child: AstNode) => void): void {
	for (const value of Object.values(node)) {
		if (asAstNode(value)) {
			visitor(value)
			continue
		}

		if (!Array.isArray(value)) continue

		for (const nested of asAstNodeArray(value)) {
			visitor(nested)
		}
	}
}

function typeParameterNames(node: AstNode): ReadonlyArray<string> {
	if (!asAstNode(node.typeParameters)) return []

	const params = Array.isArray(node.typeParameters.params)
		? asAstNodeArray(node.typeParameters.params)
		: []

	return params.flatMap((parameter) => {
		if (parameter.type !== 'TSTypeParameter') return []

		const nameNode = asAstNode(parameter.name)
			? parameter.name
			: asAstNode(parameter.id)
				? parameter.id
				: undefined

		const name =
			nameNode === undefined
				? undefined
				: decodedOption(Schema.decodeUnknownOption(Schema.String)(nameNode.name))

		return name === undefined ? [] : [name]
	})
}

function parameterTypeName(parameter: AstNode): string | undefined {
	if (!asAstNode(parameter.typeAnnotation)) return undefined

	const type = asAstNode(parameter.typeAnnotation.typeAnnotation)
		? parameter.typeAnnotation.typeAnnotation
		: undefined

	if (type?.type !== 'TSTypeReference') return undefined

	if (!asAstNode(type.typeName)) return undefined

	return decodedOption(Schema.decodeUnknownOption(Schema.String)(type.typeName.name))
}

function isGenericFunctionLike(node: AstNode): boolean {
	return (
		node.type === 'FunctionDeclaration' ||
		node.type === 'FunctionExpression' ||
		node.type === 'ArrowFunctionExpression' ||
		node.type === 'TSFunctionType' ||
		node.type === 'TSMethodSignature' ||
		node.type === 'TSDeclareFunction'
	)
}

function isUnconstrainedInputGeneric(node: AstNode): boolean {
	const names = typeParameterNames(node)

	if (names.length !== 1 || names[0] !== 'Input') return false
	const params = Array.isArray(node.params) ? asAstNodeArray(node.params) : []

	if (params.length !== 1) return false
	const onlyParameter = params[0]

	if (onlyParameter === undefined) return false

	return parameterTypeName(onlyParameter) === 'Input'
}

export function lintUnconstrainedInputGenerics(
	program: AstNode,
): UnconstrainedInputGenericDiagnostic[] {
	const diagnostics: UnconstrainedInputGenericDiagnostic[] = []
	const visited = new WeakSet<AstNode>()

	function visit(node: AstNode): void {
		if (visited.has(node)) return
		visited.add(node)

		if (isGenericFunctionLike(node) && isUnconstrainedInputGeneric(node)) {
			diagnostics.push({ message: diagnosticMessage, node })
		}

		visitChildNodes(node, visit)
	}

	visit(program)

	return diagnostics
}
