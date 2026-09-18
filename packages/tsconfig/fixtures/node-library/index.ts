import { join } from 'node:path'

// This fixture exists to prove the node-library preset works in an ESM package.
export function joinSegments(...segments: readonly string[]): string {
	return join(...segments)
}
