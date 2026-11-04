import { z } from 'zod'

import {
	createPaymentTermRequestSchema,
	paymentTermLengthSchema,
	paymentTermSchema,
	paymentTermScopeSchema
} from '@henko-software/contracts-contacts'

import { booleanParam, listParam, statusesParam } from './common.js'

/**
 * Condiciones de pago (`/admin/payment-terms`). La misma forma que en
 * `contacts`, sin lo interno (`version`, fechas), como
 * `henko-web/apps/web/src/data/payment_terms/schema.ts`.
 */

export const bffPaymentTermSchema = paymentTermSchema.omit({
	version: true,
	createdAt: true,
	updatedAt: true
})
export type BffPaymentTerm = z.infer<typeof bffPaymentTermSchema>

/** POST /api/payment-terms · PUT /api/payment-terms/:id. El código lo pone el sistema. */
export const paymentTermInputSchema = createPaymentTermRequestSchema.omit({
	id: true
})
export type PaymentTermInput = z.input<typeof paymentTermInputSchema>

/**
 * GET /api/payment-terms. `toReview` (la descripción nombra plazos que no
 * son los de la condición) lo calcula el BFF con la regla del front.
 */
export const listPaymentTermsQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	statuses: statusesParam,
	scopes: listParam(paymentTermScopeSchema),
	currentAccount: listParam(booleanParam),
	lengths: listParam(paymentTermLengthSchema),
	toReview: booleanParam.optional()
})
export type ListBffPaymentTermsQuery = z.output<
	typeof listPaymentTermsQuerySchema
>

export const listPaymentTermsBffResponseSchema = z.object({
	paymentTerms: z.array(bffPaymentTermSchema)
})

/** GET /api/payment-terms/:id · POST · PUT */
export const paymentTermBffResponseSchema = z.object({
	paymentTerm: bffPaymentTermSchema
})

/** POST /api/payment-terms/status: `setStatusBodySchema` (ids UUID). 204. */
