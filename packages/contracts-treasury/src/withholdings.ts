import { z } from 'zod'

import {
	INCOME_TAX_CONCEPTS,
	INCOME_TAX_WITHHOLDINGS,
	vatConditionSchema
} from '@henko-software/contracts-contacts'

import {
	applicationSchema,
	contactIdSchema,
	currencyFields,
	isoDateSchema,
	positiveCentsSchema,
	refineCurrency
} from './common.js'
import { WITHHOLDING_TAXES } from './receipts.js'

/**
 * Retenciones que Big Pizza le hace a un proveedor al pagarle (agente de
 * retención: Ganancias RG 830, Ingresos Brutos, IVA). Las calcula treasury
 * con su tabla de alícuotas (config) y cada una lleva su certificado.
 * Todo en pesos.
 */

export const withholdingTaxSchema = z.enum(WITHHOLDING_TAXES)

/** Lo que dice el proveedor de sus impuestos (contacts), lo trae el BFF. */
export const supplierTaxSchema = z.object({
	vatCondition: vatConditionSchema.nullable().default(null),
	incomeTaxWithholding: z
		.enum(INCOME_TAX_WITHHOLDINGS)
		.nullable()
		.default(null),
	incomeTaxConcept: z.enum(INCOME_TAX_CONCEPTS).nullable().default(null)
})
export type SupplierTax = z.output<typeof supplierTaxSchema>

/** Una retención calculada (sin certificado todavía). */
export const withholdingDraftSchema = z.object({
	tax: withholdingTaxSchema,
	jurisdiction: z.string().max(40).nullable(),
	/** «RG 830 · Compra de bienes». */
	regime: z.string().max(80),
	/** Sobre cuánto se calculó, en centavos. */
	base: z.number().int().min(0),
	ratePct: z.number().min(0).max(100),
	amount: positiveCentsSchema
})
export type WithholdingDraft = z.infer<typeof withholdingDraftSchema>

/** Una retención hecha, con su certificado (`0001-00000001`). */
export const appliedWithholdingSchema = withholdingDraftSchema.extend({
	certificate: z.string().min(1).max(30)
})
export type AppliedWithholding = z.infer<typeof appliedWithholdingSchema>

/**
 * `POST /internal/payment-orders/withholdings` — lo que se le va a retener
 * en una orden con esas facturas, para mostrarlo antes de registrar (lo
 * que se paga = lo aplicado menos las retenciones).
 */
export const withholdingsPreviewRequestSchema = z
	.object({
		supplier: z.object({
			id: contactIdSchema,
			tax: supplierTaxSchema.default({
				vatCondition: null,
				incomeTaxWithholding: null,
				incomeTaxConcept: null
			})
		}),
		date: isoDateSchema,
		applications: z.array(applicationSchema).max(200),
		/** Impuestos que no se le retienen (certificado de exclusión). */
		withholdingExempt: z.array(withholdingTaxSchema).max(4).default([]),
		...currencyFields
	})
	.superRefine(refineCurrency)
export type WithholdingsPreviewRequest = z.output<
	typeof withholdingsPreviewRequestSchema
>
export const withholdingsPreviewResponseSchema = z.object({
	withholdings: z.array(withholdingDraftSchema)
})
