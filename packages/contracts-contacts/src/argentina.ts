import { z } from 'zod'

/**
 * Tablas fijas de Argentina y formatos que repiten casi todas las fichas. Son
 * los mismos códigos que usa `henko-web` (`data/shared/argentina.ts`): los
 * nombres que ve el usuario los pone el front.
 *
 * Si otro módulo los necesita, conviene moverlos a un `contracts-shared`.
 */

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

/** País, en código ISO de dos letras (AR, UY, CL). */
export const countryCodeSchema = z.string().regex(/^[A-Z]{2}$/)

/** Condición frente al IVA, con las abreviaturas de Aires. */
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

/** Baja lógica, como en Aires («Activos» / «Eliminados»). */
export const RECORD_STATUSES = ['active', 'deleted'] as const
export const recordStatusSchema = z.enum(RECORD_STATUSES)
export type RecordStatus = z.infer<typeof recordStatusSchema>

/** Fecha sin hora: 2026-10-21. */
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** Coordenadas para el mapa. Aires no las tiene: salen de geocodificar. */
export const geoPointSchema = z.object({
	lat: z.number().min(-90).max(90),
	lng: z.number().min(-180).max(180)
})

const CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const

/**
 * Dígito verificador de CUIT/CUIL (módulo 11). Acepta con o sin guiones.
 * Si el cálculo da 11 el dígito es 0; si da 10, el número no existe.
 */
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

/** CUIT/CUIL con guiones y dígito verificador válido: 20-12345678-6. */
export const cuitSchema = z
	.string()
	.regex(/^\d{2}-\d{8}-\d$/, 'Con guiones: 20-12345678-6.')
	.refine(isValidCuit, 'El dígito verificador no es válido.')

/** Los tipos de documento que llevan formato de CUIT. */
export const isCuitDocType = (docType: DocType): boolean =>
	docType === 'CUIT' || docType === 'CUIL'

/**
 * Para el `superRefine` de las fichas con tipo y número de documento: si es
 * CUIT o CUIL, el número tiene que ser uno válido (con guiones).
 */
export const refineDocNumber = (
	doc: { docType: DocType | null; docNumber: string | null },
	context: z.RefinementCtx,
	path: (string | number)[] = ['docNumber']
): void => {
	if (!doc.docType || !isCuitDocType(doc.docType)) return
	if (!cuitSchema.safeParse(doc.docNumber ?? '').success)
		context.addIssue({
			code: 'custom',
			path,
			message: `${doc.docType} inválido: 20-12345678-6`
		})
}

const CBU_BLOCK_1 = [7, 1, 3, 9, 7, 1, 3]
const CBU_BLOCK_2 = [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3]

const cbuCheckDigit = (digits: string, weights: number[]): number => {
	const sum = weights.reduce(
		(total, weight, index) => total + weight * Number(digits[index] ?? 0),
		0
	)
	return (10 - (sum % 10)) % 10
}

/** CBU o CVU: 22 números y los dos verificadores del BCRA bien. */
export const isValidCbu = (value: string): boolean =>
	/^\d{22}$/.test(value) &&
	cbuCheckDigit(value.slice(0, 7), CBU_BLOCK_1) === Number(value[7]) &&
	cbuCheckDigit(value.slice(8, 21), CBU_BLOCK_2) === Number(value[21])

export const cbuSchema = z
	.string()
	.regex(/^\d{22}$/, 'Son 22 números.')
	.refine(isValidCbu, 'El CBU no es válido.')

/** Código de Aires: 6 dígitos con ceros adelante (001521). */
export const airesCodeSchema = z.string().regex(/^\d{6}$/)

/** Cuenta del plan de cuentas, con el formato de Aires: 1-1-31-1-001. */
export const accountCodeSchema = z.string().regex(/^\d-\d-\d{2}-\d-\d{3}$/)

/**
 * Código de una tabla auxiliar abierta (Tipo de Cliente, Canal de Venta,
 * rubros). El registro acepta cualquier código: no se valida contra la tabla
 * para que la migración no rebote valores que no conocemos.
 */
export const lookupCodeSchema = z.string().trim().min(1).max(40)
