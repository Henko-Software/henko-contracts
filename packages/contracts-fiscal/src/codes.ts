import { z } from 'zod'

/**
 * Tablas fijas que comparten el front y el módulo fiscal, con los códigos de
 * Henko (los de `henko-web/docs/back/shared.md`) y su equivalente en ARCA.
 * Fuente de los códigos de ARCA: «Manual para el desarrollador — RG 4291,
 * Proyecto FE v4.7» (WSFEv1, revisión 1/9/2026) y el manual de
 * ws_sr_constancia_inscripcion v3.4.
 */

/** Condición frente al IVA, con las abreviaturas de Aires (igual que el front). */
export const VAT_CONDITIONS = [
	'RI',
	'MT',
	'EX',
	'CF',
	'NR',
	'SE',
	'EXT',
	'NC',
	'RNI'
] as const
export const vatConditionSchema = z.enum(VAT_CONDITIONS)
export type VatCondition = z.infer<typeof vatConditionSchema>

/**
 * `CondicionIVAReceptorId` de WSFEv1 (FEParamGetCondicionIvaReceptor, RG
 * 5616). `null` = no hay código en ARCA: no se puede facturar hasta corregir
 * la condición del cliente.
 *
 * - `EX` y `SE` van los dos a 4 («IVA Sujeto Exento»): en ARCA son lo mismo.
 * - `NR` (no responsable) va a 15 («IVA No Alcanzado»), lo más cercano.
 * - `EXT` va a 9 («Cliente del Exterior»).
 * - `RNI` (responsable no inscripto) ya no existe en ARCA.
 */
export const ARCA_RECEIVER_VAT_CONDITION: Record<VatCondition, number | null> =
	{
		RI: 1,
		MT: 6,
		EX: 4,
		SE: 4,
		CF: 5,
		NR: 15,
		EXT: 9,
		NC: 7,
		RNI: null
	}

/** Clases de comprobante que acepta cada `CondicionIVAReceptorId` (anexo del manual WSFEv1). */
export const ARCA_RECEIVER_CONDITION_LETTERS: Record<
	number,
	readonly ('A' | 'B' | 'C')[]
> = {
	1: ['A', 'C'],
	4: ['B', 'C'],
	5: ['B', 'C'],
	6: ['A', 'C'],
	7: ['B', 'C'],
	8: ['B', 'C'],
	9: ['B', 'C'],
	10: ['B', 'C'],
	13: ['A', 'C'],
	15: ['B', 'C'],
	16: ['A', 'C']
}

/** «T.Doc.» de Aires. */
export const VOUCHER_KINDS = ['invoice', 'debit_note', 'credit_note'] as const
export const voucherKindSchema = z.enum(VOUCHER_KINDS)
export type VoucherKind = z.infer<typeof voucherKindSchema>

/** La E (exportación) va por otro web service de ARCA (WSFEX): el modelo la acepta, el módulo todavía no. */
export const VOUCHER_LETTERS = ['A', 'B', 'C', 'E'] as const
export const voucherLetterSchema = z.enum(VOUCHER_LETTERS)
export type VoucherLetter = z.infer<typeof voucherLetterSchema>

/** `CbteTipo` de ARCA (FEParamGetTiposCbte). Igual que `ARCA_DOC_CODES` del front. */
export const ARCA_VOUCHER_TYPES: Record<
	VoucherLetter,
	Record<VoucherKind, number>
> = {
	A: { invoice: 1, debit_note: 2, credit_note: 3 },
	B: { invoice: 6, debit_note: 7, credit_note: 8 },
	C: { invoice: 11, debit_note: 12, credit_note: 13 },
	E: { invoice: 19, debit_note: 20, credit_note: 21 }
}

/** Alícuotas de IVA de Henko (igual que `VAT_RATES` del front) y su porcentaje. */
export const VAT_RATES = [
	'general',
	'reduced',
	'increased',
	'not_taxed'
] as const
export const vatRateSchema = z.enum(VAT_RATES)
export type VatRate = z.infer<typeof vatRateSchema>

export const VAT_PERCENT: Record<VatRate, number> = {
	general: 21,
	reduced: 10.5,
	increased: 27,
	not_taxed: 0
}

/**
 * `Id` de `AlicIva` (FEParamGetTiposIva): 4 = 10,5 %, 5 = 21 %, 6 = 27 %.
 * `not_taxed` no va en el array de IVA: suma en `ImpTotConc` (no gravado).
 */
export const ARCA_VAT_RATE_IDS: Record<
	Exclude<VatRate, 'not_taxed'>,
	number
> = {
	general: 5,
	reduced: 4,
	increased: 6
}

/** Tipos de documento de Henko (igual que el front). */
export const DOC_TYPES = [
	'CUIT',
	'CUIL',
	'DNI',
	'CDI',
	'LE',
	'LC',
	'PAS',
	'CIP'
] as const
export const docTypeSchema = z.enum(DOC_TYPES)
export type DocType = z.infer<typeof docTypeSchema>

/** `DocTipo` de ARCA (FEParamGetTiposDoc). 99 = sin identificar. */
export const ARCA_DOC_TYPES: Record<DocType, number> = {
	CUIT: 80,
	CUIL: 86,
	CDI: 87,
	LE: 89,
	LC: 90,
	PAS: 94,
	DNI: 96,
	CIP: 0
}
export const ARCA_DOC_TYPE_UNIDENTIFIED = 99

/** Provincias de Henko (igual que el front). */
export const PROVINCES = [
	'CF',
	'BA',
	'CA',
	'CH',
	'CT',
	'CO',
	'CR',
	'ER',
	'FO',
	'JU',
	'LP',
	'LR',
	'ME',
	'MI',
	'NE',
	'RN',
	'SA',
	'SJ',
	'SL',
	'SC',
	'SF',
	'SE',
	'TF',
	'TU'
] as const
export const provinceSchema = z.enum(PROVINCES)
export type Province = z.infer<typeof provinceSchema>

/** `idProvincia` del padrón de ARCA (tabla SUPA) → provincia de Henko. */
export const ARCA_PROVINCE_IDS: Record<number, Province> = {
	0: 'CF',
	1: 'BA',
	2: 'CA',
	3: 'CO',
	4: 'CR',
	5: 'ER',
	6: 'JU',
	7: 'ME',
	8: 'LR',
	9: 'SA',
	10: 'SJ',
	11: 'SL',
	12: 'SF',
	13: 'SE',
	14: 'TU',
	16: 'CH',
	17: 'CT',
	18: 'FO',
	19: 'MI',
	20: 'NE',
	21: 'LP',
	22: 'RN',
	23: 'SC',
	24: 'TF'
}

/** CUIT válido: 11 dígitos y dígito verificador (módulo 11), como `isValidCuit` del front. */
const CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const
export const isValidCuit = (value: string): boolean => {
	const digits = value.replace(/\D/g, '')
	if (digits.length !== 11) return false
	const sum = CUIT_WEIGHTS.reduce(
		(total, weight, index) => total + weight * Number(digits[index]),
		0
	)
	const rest = 11 - (sum % 11)
	const check = rest === 11 ? 0 : rest
	return check !== 10 && check === Number(digits[10])
}

/** CUIT en 11 dígitos sin guiones, con verificador válido. */
export const cuitDigitsSchema = z
	.string()
	.regex(/^\d{11}$/)
	.refine(isValidCuit, 'Dígito verificador inválido')
