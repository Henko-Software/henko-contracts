import { z } from 'zod'

import {
	actorRefSchema,
	applicationSchema,
	chequeNumberSchema,
	contactIdSchema,
	documentNumberSchema,
	historyEntrySchema,
	isoDateSchema,
	listParam,
	openItemRefSchema,
	positiveCentsSchema,
	treasuryIdSchema,
	voidedSchema
} from './common.js'

/**
 * Recibos (Aires: Tesorería › Cobranzas): lo que paga un cliente, cómo lo
 * pagó, las retenciones que le hizo y qué facturas cancela. Recibo X: sin
 * CAI ni CAE. Forma de `henko-web/apps/web/src/data/receipts/schema.ts`.
 * Se anota en `ledger` con `treasury.receipt.issued.v1`.
 */

export const RECEIPT_VALUE_KINDS = [
	'transfer',
	'echeq',
	'cheque',
	'cash',
	'mercadopago'
] as const
export type ReceiptValueKind = (typeof RECEIPT_VALUE_KINDS)[number]
/** Los que entran a una cuenta (banco o billetera). */
export const DEPOSITED_KINDS: readonly ReceiptValueKind[] = [
	'transfer',
	'mercadopago'
]
/** Los que van a la cartera de cheques. */
export const CHEQUE_KINDS: readonly ReceiptValueKind[] = ['echeq', 'cheque']

export const receiptChequeSchema = z.object({
	bank: z.string().trim().min(1).max(60),
	number: chequeNumberSchema,
	payDate: isoDateSchema
})

const receiptValueShape = z.object({
	kind: z.enum(RECEIPT_VALUE_KINDS),
	amount: positiveCentsSchema,
	bankAccountId: treasuryIdSchema.nullable(),
	cheque: receiptChequeSchema.nullable()
})
type ReceiptValueShape = z.infer<typeof receiptValueShape>

const valueRules = (value: ReceiptValueShape, ctx: z.RefinementCtx) => {
	if (DEPOSITED_KINDS.includes(value.kind) && !value.bankAccountId)
		ctx.addIssue({
			code: 'custom',
			path: ['bankAccountId'],
			message: 'Falta la cuenta a la que entró.'
		})
	if (!DEPOSITED_KINDS.includes(value.kind) && value.bankAccountId)
		ctx.addIssue({
			code: 'custom',
			path: ['bankAccountId'],
			message: 'Sólo una transferencia o Mercado Pago entran a una cuenta.'
		})
	if (CHEQUE_KINDS.includes(value.kind) !== Boolean(value.cheque))
		ctx.addIssue({
			code: 'custom',
			path: ['cheque'],
			message: CHEQUE_KINDS.includes(value.kind)
				? 'Faltan los datos del cheque.'
				: 'Sólo un cheque o e-cheq lleva sus datos.'
		})
}

export const receiptValueInputSchema = receiptValueShape.superRefine(valueRules)
/** Un medio del recibo; si es cheque, el id con que quedó en la cartera. */
export const receiptValueSchema = receiptValueShape.extend({
	chequeId: treasuryIdSchema.nullable()
})
export type ReceiptValue = z.infer<typeof receiptValueSchema>

export const WITHHOLDING_TAXES = ['iibb', 'ganancias', 'iva', 'suss'] as const
export const withholdingSchema = z.object({
	tax: z.enum(WITHHOLDING_TAXES),
	jurisdiction: z.string().trim().max(40).nullable(),
	certificate: z.string().trim().min(1).max(30),
	amount: positiveCentsSchema
})
export type Withholding = z.infer<typeof withholdingSchema>

export const RECEIPT_STATES = ['applied', 'on_account'] as const
export const receiptStateSchema = z.enum(RECEIPT_STATES)

export const receiptSchema = z.object({
	id: treasuryIdSchema,
	number: documentNumberSchema,
	customerId: contactIdSchema,
	/** El local del cliente al registrar (alcance); `null` = casa central. */
	localId: z.string().nullable(),
	date: isoDateSchema,
	values: z.array(receiptValueSchema).min(1),
	withholdings: z.array(withholdingSchema),
	applications: z.array(applicationSchema),
	notes: z.string().max(500).nullable(),
	/** Medios más retenciones. */
	total: positiveCentsSchema,
	/** Lo que quedó a favor del cliente. */
	onAccount: z.number().int().min(0),
	state: receiptStateSchema,
	createdBy: actorRefSchema,
	createdAt: z.iso.datetime(),
	voided: voidedSchema
})
export type Receipt = z.infer<typeof receiptSchema>

const sumOf = (rows: { amount: number }[]) =>
	rows.reduce((total, row) => total + row.amount, 0)

/**
 * `POST /internal/receipts`. Con un `id` que ya existe no duplica: 200 con
 * el que hay. `customer` y `openItems` los trae el BFF (de contacts y de
 * ledger): treasury controla que cada factura todavía deba lo que se le
 * aplica (si no, `treasury.receipt_application_exceeds`).
 */
export const createReceiptRequestSchema = z
	.object({
		id: treasuryIdSchema.optional(),
		customer: z.object({
			id: contactIdSchema,
			localId: z.string().nullable(),
			/** Nombre y código, para el buscador. */
			label: z.string().max(200)
		}),
		date: isoDateSchema,
		values: z.array(receiptValueInputSchema).min(1).max(50),
		withholdings: z.array(withholdingSchema).max(20),
		applications: z.array(applicationSchema).max(200),
		notes: z.string().trim().max(500).nullable(),
		openItems: z.array(openItemRefSchema).max(2000)
	})
	.superRefine((input, ctx) => {
		if (
			sumOf(input.applications) >
			sumOf(input.values) + sumOf(input.withholdings)
		)
			ctx.addIssue({
				code: 'custom',
				path: ['applications'],
				message: 'Se aplica más de lo que entró.'
			})
		const ids = input.applications.map(row => row.movementId)
		if (new Set(ids).size !== ids.length)
			ctx.addIssue({
				code: 'custom',
				path: ['applications'],
				message: 'Una factura está más de una vez.'
			})
	})
export type CreateReceiptRequest = z.output<typeof createReceiptRequestSchema>

/** `GET /internal/receipts` */
export const listReceiptsQuerySchema = z.object({
	query: z.string().trim().max(80).optional(),
	customerIds: listParam(contactIdSchema),
	states: listParam(receiptStateSchema),
	dateFrom: isoDateSchema.optional(),
	dateTo: isoDateSchema.optional(),
	/** Los anulados no salen salvo que se pidan. */
	includeVoided: z
		.enum(['true', 'false'])
		.transform(value => value === 'true')
		.optional(),
	limit: z.coerce.number().int().min(1).max(1000).default(500)
})
export type ListReceiptsQuery = z.output<typeof listReceiptsQuerySchema>
export const listReceiptsResponseSchema = z.object({
	receipts: z.array(receiptSchema)
})
export const receiptResponseSchema = z.object({ receipt: receiptSchema })
export const receiptDetailResponseSchema = z.object({
	receipt: receiptSchema,
	history: z.array(historyEntrySchema)
})
