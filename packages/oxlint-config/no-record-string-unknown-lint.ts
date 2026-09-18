import { Schema } from 'effect'

import { asAstNode, asAstNodeArray, decodedOption, type AstNode } from './json-decode.ts'

export interface NoRecordStringUnknownDiagnostic {
	message: string
	node: AstNode
}

/**
 * Named boundary aliases may spell exact `Record<string, unknown>` once (see `SLOP.md`). A matching
 * suffix alone is not enough: the alias RHS must be that exact bag (optionally through transparent
 * `Readonly` / parentheses). Nested bags inside alias bodies are still reported.
 */
const boundaryAliasNamePattern = /(?:Bag|Claims|Encoded|Extra|Input|Payload|Row|Wire)$/u

const diagnosticMessage =
	'Avoid anonymous `Record<string, unknown>`; name a boundary input/Encoded type or decode with Schema (see SLOP.md).'

function getTypeParameters(node: AstNode): AstNode[] {
	const typeParameters = asAstNode(node.typeParameters)
		? node.typeParameters
		: asAstNode(node.typeArguments)
			? node.typeArguments
			: undefined

	if (typeParameters === undefined) {
		return []
	}

	return Array.isArray(typeParameters.params) ? asAstNodeArray(typeParameters.params) : []
}

function isIdentifierNamed(node: AstNode | undefined, name: string): boolean {
	return (
		node !== undefined &&
		node.type === 'Identifier' &&
		decodedOption(Schema.decodeUnknownOption(Schema.String)(node.name)) === name
	)
}

function isRecordStringUnknown(node: AstNode): boolean {
	if (
		node.type !== 'TSTypeReference' ||
		!isIdentifierNamed(asAstNode(node.typeName) ? node.typeName : undefined, 'Record')
	) {
		return false
	}

	const [keyType, valueType] = getTypeParameters(node)

	return keyType?.type === 'TSStringKeyword' && valueType?.type === 'TSUnknownKeyword'
}

function unwrapTransparentType(node: AstNode): AstNode {
	let current = node

	for (let depth = 0; depth < 8; depth += 1) {
		if (current.type === 'TSParenthesizedType' && asAstNode(current.typeAnnotation)) {
			current = current.typeAnnotation
			continue
		}

		if (
			current.type === 'TSTypeReference' &&
			isIdentifierNamed(asAstNode(current.typeName) ? current.typeName : undefined, 'Readonly')
		) {
			const [inner] = getTypeParameters(current)

			if (inner !== undefined) {
				current = inner
				continue
			}
		}

		break
	}

	return current
}

function getTypeAliasName(node: AstNode): string | undefined {
	if (
		node.type !== 'TSTypeAliasDeclaration' ||
		!asAstNode(node.id) ||
		node.id.type !== 'Identifier'
	) {
		return undefined
	}

	return decodedOption(Schema.decodeUnknownOption(Schema.String)(node.id.name))
}

function getTypeAliasAnnotation(node: AstNode): AstNode | undefined {
	if (node.type !== 'TSTypeAliasDeclaration' || !asAstNode(node.typeAnnotation)) {
		return undefined
	}

	return node.typeAnnotation
}

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

/**
 * Collect exact `Record<string, unknown>` nodes that are the entire RHS of a boundary-named alias
 * (after transparent wrappers). Nested Records elsewhere in those aliases stay reportable.
 */
function collectAllowedExactBoundaryRecords(program: AstNode): WeakSet<AstNode> {
	const allowed = new WeakSet<AstNode>()
	const visited = new WeakSet<AstNode>()

	function visit(node: AstNode): void {
		if (visited.has(node)) return
		visited.add(node)

		const aliasName = getTypeAliasName(node)
		const annotation = getTypeAliasAnnotation(node)

		if (
			aliasName !== undefined &&
			boundaryAliasNamePattern.test(aliasName) &&
			annotation !== undefined
		) {
			const unwrapped = unwrapTransparentType(annotation)

			if (isRecordStringUnknown(unwrapped)) {
				allowed.add(unwrapped)
			}
		}

		visitChildNodes(node, visit)
	}

	visit(program)

	return allowed
}

export function lintNoRecordStringUnknown(program: AstNode): NoRecordStringUnknownDiagnostic[] {
	const diagnostics: NoRecordStringUnknownDiagnostic[] = []
	const visited = new WeakSet<AstNode>()
	const allowedExactBoundaryRecords = collectAllowedExactBoundaryRecords(program)

	function visit(node: AstNode): void {
		if (visited.has(node)) return
		visited.add(node)

		if (isRecordStringUnknown(node) && !allowedExactBoundaryRecords.has(node)) {
			diagnostics.push({ message: diagnosticMessage, node })
		}

		visitChildNodes(node, visit)
	}

	visit(program)

	return diagnostics
}
