import { z } from 'zod'

import { accountCodeSchema, recordStatusSchema } from './argentina.js'
import { booleanParam, listParam } from './params.js'

/**
 * Condiciones de pago (Aires: Condiciones Clientes y Condiciones
 * Proveedores, juntas en una tabla con `scopes`). Hasta 8 vencimientos que
 * suman 100 %, sin dos el mismo día.
 */

export const PAYMENT_TERM_SCOPES = ['customers', 'suppliers'] as const
export const paymentTermScopeSchema = z.enum(PAYMENT_TERM_SCOPES)
export type PaymentTermScope = z.infer<typeof paymentTermScopeSchema>

export const MAX_INSTALLMENTS = 8

/** ¿Tiene dos decimales como máximo? 33,33 sí; 33,333 no. */
const hasHundredthsAtMost = (value: number): boolean =>
	Math.abs(Math.round(value * 100) - value * 100) < 1e-6

/** Suma de los porcentajes, comparando en centésimos (33,33 + 33,33 + 33,34 = 100). */
const totalHundredths = (list: { percent: number }[]): number =>
	list.reduce((total, item) => total + Math.round(item.percent * 100), 0)

export const installmentSchema = z.object({
	percent: z
		.number()
		.gt(0)
		.max(100)
		.refine(hasHundredthsAtMost, 'Hasta dos decimales.'),
	days: z.number().int().min(0).max(365)
})
export type Installment = z.infer<typeof installmentSchema>

const legacyCodeSchema = z.string().regex(/^\d{1,6}$/)

const paymentTermFields = {
	/** Los códigos que tenía en las dos tablas de Aires, para reapuntar lo migrado. */
	legacyCodes: z.object({
		customers: z.array(legacyCodeSchema).max(50),
		suppliers: z.array(legacyCodeSchema).max(50)
	}),
	description: z.string().trim().min(1).max(60),
	scopes: z.array(paymentTermScopeSchema).min(1),
	/** Genera deuda en la cuenta corriente. */
	currentAccount: z.boolean(),
	/** Sólo si `scopes` incluye clientes; si no, `null`. */
	customerAccountCode: accountCodeSchema.nullable(),
	/** Sólo si `scopes` incluye proveedores; si no, `null`. */
	supplierAccountCode: accountCodeSchema.nullable(),
	/** Se guardan ordenados por días. */
	installments: z
		.array(installmentSchema)
		.min(1)
		.max(MAX_INSTALLMENTS)
		.refine(
			list => totalHundredths(list) === 10_000,
			'Los vencimientos tienen que sumar 100 %.'
		)
		.refine(
			list => new Set(list.map(item => item.days)).size === list.length,
			'Hay dos vencimientos el mismo día.'
		)
}

export const paymentTermSchema = z.object({
	id: z.uuid(),
	/** Corto, como Aires (1, 7, 30, 193). Lo pone el sistema: el siguiente al más alto. */
	code: legacyCodeSchema,
	...paymentTermFields,
	status: recordStatusSchema,
	version: z.number().int().min(1),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime()
})
export type PaymentTerm = z.infer<typeof paymentTermSchema>

/** POST /internal/payment-terms. Con `id` repetido no se duplica: devuelve la que hay. */
export const createPaymentTermRequestSchema = z.object({
	id: z.uuid().optional(),
	...paymentTermFields
})
export type CreatePaymentTermRequest = z.input<
	typeof createPaymentTermRequestSchema
>

/** PUT /internal/payment-terms/:id — objeto entero. */
export const updatePaymentTermRequestSchema = z.object({
	...paymentTermFields,
	expectedVersion: z.number().int().min(1).optional()
})

export const paymentTermResponseSchema = z.object({
	paymentTerm: paymentTermSchema
})

/** Plazo, por el último vencimiento: 0 contado, ≤30, ≤60, más. */
export const PAYMENT_TERM_LENGTHS = [
	'cash',
	'upTo30',
	'upTo60',
	'over60'
] as const
export const paymentTermLengthSchema = z.enum(PAYMENT_TERM_LENGTHS)

/** GET /internal/payment-terms. Orden: último vencimiento, cantidad, descripción. */
export const listPaymentTermsQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	statuses: listParam(recordStatusSchema),
	scopes: listParam(paymentTermScopeSchema),
	currentAccount: listParam(booleanParam),
	lengths: listParam(paymentTermLengthSchema)
})
export type ListPaymentTermsQuery = z.output<typeof listPaymentTermsQuerySchema>

export const listPaymentTermsResponseSchema = z.object({
	paymentTerms: z.array(paymentTermSchema)
})

/** POST /internal/payment-terms/status — baja o recuperación, todo o nada. 204. */
export const setPaymentTermStatusRequestSchema = z.object({
	ids: z.array(z.uuid()).min(1).max(500),
	status: recordStatusSchema
})
