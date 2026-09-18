// This fixture exists to prove the shared base preset type-checks real TS code.
export function firstOrFallback(values: readonly string[], fallback?: string): string | undefined {
	return values[0] ?? fallback
}
