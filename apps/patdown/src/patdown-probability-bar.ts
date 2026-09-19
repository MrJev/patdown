const patdownProbabilityBarFilled = '▓'

const patdownProbabilityBarPartial = '▒'

const patdownProbabilityBarEmpty = '░'

const patdownProbabilityBarWidth = 10

function clampPatdownProbability(probability: number): number {
	if (probability <= 0) return 0

	if (probability >= 1) return 1

	return probability
}

/** Ten-cell shade bar for estimated P(yes). Search for ▓ ▒ ░ to find the glyphs. */
export function formatPatdownProbabilityBar(probability: number): string {
	const filledCells = clampPatdownProbability(probability) * patdownProbabilityBarWidth
	const cells: string[] = []

	for (let index = 0; index < patdownProbabilityBarWidth; index += 1) {
		const cellFill = filledCells - index

		if (cellFill >= 1) {
			cells.push(patdownProbabilityBarFilled)
			continue
		}

		if (cellFill >= 0.5) {
			cells.push(patdownProbabilityBarPartial)
			continue
		}

		cells.push(patdownProbabilityBarEmpty)
	}

	return cells.join('')
}
