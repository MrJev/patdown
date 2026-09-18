/** Noul must exceed this to count as yes. Tune in code, not in the model. */
export const jevNoulYesThreshold = 0.85

/** True when Jev's noul is a yes we would act on. */
export function jevNoulIsYes(noul: number): boolean {
	return noul > jevNoulYesThreshold
}
