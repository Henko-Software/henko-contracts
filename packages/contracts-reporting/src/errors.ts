/** Claves de error propias de reporting (además de las `common.*`). */
export const REPORTING_ERRORS = [
	/** El rubro no existe (front `H-NOTFOUND`). */
	'reporting.line_not_found',
	/** El código ya lo tiene otro rubro (front `H-RB002`). */
	'reporting.code_taken',
	/** La fórmula de un subtotal termina usándose a sí misma (front `H-RB003`). */
	'reporting.formula_loop',
	/**
	 * Baja de un rubro que usa la fórmula de un subtotal activo o que tiene
	 * rubros activos adentro (front `H-RB004`).
	 */
	'reporting.line_in_use',
	/**
	 * El rubro de arriba no corresponde: no existe, no está activo, no es un
	 * título o el código no va adentro de él.
	 */
	'reporting.invalid_parent',
	/** Una fórmula usa un rubro que no existe o está dado de baja. */
	'reporting.invalid_formula',
	/** Escribir sobre una versión vieja del rubro. */
	'reporting.version_conflict'
] as const
export type ReportingErrorKey = (typeof REPORTING_ERRORS)[number]
