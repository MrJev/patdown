import type { AstNode } from './json-decode.ts'

export interface PhantomNeverMappedTypeDiagnostic {
	message: string
	node: AstNode
}

const diagnosticMessage =
	'Do not invent phantom mapped types over `never`. Relate `K extends keyof T` to `T[K]`, or keep honest `unknown` at the edge.'

type HostAstNode = AstNode & { readonly type: string }

/** FIRST-DECODER(unknown, typeof): oxlint host AST nodes are cyclic and are not Schema.Json. */
function isHostAstNode(value: unknown): value is HostAstNode {
	if (typeof value !== 'object' || value === null || !('type' in value)) return false
	const host: object & { type: unknown } = value

	return typeof host.type === 'string'
}

function visitChildNodes(node: AstNode, visitor: (child: AstNode) => void): void {
	for (const value of Object.values(node)) {
		if (isHostAstNode(value)) {
			visitor(value)
			continue
		}

		if (!Array.isArray(value)) continue

		for (const nested of value) {
			if (isHostAstNode(nested)) visitor(nested)
		}
	}
}

function isNeverConstraint(node: AstNode | undefined): boolean {
	return node?.type === 'TSNeverKeyword'
}

function mappedTypeConstraint(node: AstNode): AstNode | undefined {
	// SAFETY: oxlint TSMappedType nodes keep constraint/typeParameter beyond the decoded type field.
	const record = node as AstNode & { constraint?: unknown; typeParameter?: unknown }

	if (isHostAstNode(record.constraint)) return record.constraint

	if (!isHostAstNode(record.typeParameter)) return undefined
	// SAFETY: oxlint TSTypeParameter nodes keep constraint beyond the decoded type field.
	const typeParameterRecord = record.typeParameter as AstNode & { constraint?: unknown }

	return isHostAstNode(typeParameterRecord.constraint) ? typeParameterRecord.constraint : undefined
}

function isPhantomNeverMappedType(node: AstNode): boolean {
	return node.type === 'TSMappedType' && isNeverConstraint(mappedTypeConstraint(node))
}

export function lintPhantomNeverMappedTypes(program: AstNode): PhantomNeverMappedTypeDiagnostic[] {
	const diagnostics: PhantomNeverMappedTypeDiagnostic[] = []
	const visited = new WeakSet<AstNode>()

	function visit(node: AstNode): void {
		if (visited.has(node)) return
		visited.add(node)

		if (isPhantomNeverMappedType(node)) {
			diagnostics.push({ message: diagnosticMessage, node })
		}

		visitChildNodes(node, visit)
	}

	visit(program)

	return diagnostics
}
