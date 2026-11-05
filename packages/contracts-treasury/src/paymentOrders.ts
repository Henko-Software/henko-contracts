import { z } from 'zod'

import {
	actorRefSchema,
	applicationSchema,
	booleanParam,
	chequeNumberSchema,
	contactIdSchema,
	documentNumberSchema,
	historyEntrySchema,
	idsSchema,
	isoDateSchema,
	listParam,
	openItemRefSchema,
	positiveCentsSchema,
	treasuryIdSchema,
	voidedSchema
} from './common.js'

/**
 * Órdenes de pago a proveedores (Aires: Tesorería › Pagos): qué facturas
 * paga y con qué. Forma de
 * `henko-web/apps/web/src/data/payment_orders/schema.ts`. Se anota en
 * `ledger` con `treasury.payment_order.issued.v1`.
 */

export const PAYMENT_VALUE_KINDS = [
	'transfer',
	'endorsed',
	'echeq',
	'cash'
] as const

/** Cuántos billetes de cada uno («12 de $ 20.000»). */
export const billCountSchema = z.object({
	face: z.number().int().positive(),
	count: z.number().int().positive()
})
/** Lo que suman los billetes, en centavos. */
export const billsTotal = (bills: { face: number; count: number }[]) =>
	bills.reduce((sum, row) => sum + row.face * row.count * 100, 0)

export const paymentValueSchema = z
	.object({
		kind: z.enum(PAYMENT_VALUE_KINDS),
		amount: positiveCentsSchema,
		bankAccountId: treasuryIdSchema.nullable(),
		chequeId: treasuryIdSchema.nullable(),
		echeq: z
			.object({ number: chequeNumberSchema, payDate: isoDateSchema })
			.nullable(),
		bills: z.array(billCountSchema).nullable().default(null)
	})
	.superRefine((value, ctx) => {
		const fromAccount = value.kind === 'transfer' || value.kind === 'echeq'
		if (fromAccount !== Boolean(value.bankAccountId))
			ctx.addIssue({
				code: 'custom',
				path: ['bankAccountId'],
				message: fromAccount
					? 'Falta la cuenta de la que sale.'
					: 'Sólo una transferencia o un e-cheq salen de una cuenta.'
			})
		if ((value.kind === 'endorsed') !== Boolean(value.chequeId))
			ctx.addIssue({
				code: 'custom',
				path: ['chequeId'],
				message: 'El cheque va sólo en un endoso, y un endoso lleva su cheque.'
			})
		if ((value.kind === 'echeq') !== Boolean(value.echeq))
			ctx.addIssue({
				code: 'custom',
				path: ['echeq'],
				message: 'Los datos del e-cheq van sólo en un e-cheq propio.'
			})
	})
export type PaymentValue = z.infer<typeof paymentValueSchema>

export const paymentOrderSchema = z.object({
	id: treasuryIdSchema,
	number: documentNumberSchema,
	supplierId: contactIdSchema,
	date: isoDateSchema,
	applications: z.array(applicationSchema),
	values: z.array(paymentValueSchema).min(1),
	notes: z.string().max(500).nullable(),
	total: positiveCentsSchema,
	delivered: z.boolean(),
	deliveredAt: isoDateSchema.nullable(),
	createdBy: actorRefSchema,
	createdAt: z.iso.datetime(),
	voided: voidedSchema
})
export type PaymentOrder = z.infer<typeof paymentOrderSchema>

const sumOf = (rows: { amount: number }[]) =>
	rows.reduce((total, row) => total + row.amount, 0)

/**
 * `POST /internal/payment-orders`. Con un `id` que ya existe no duplica.
 * `supplier` y `openItems` los trae el BFF; un cheque endosado tiene que
 * estar en la cartera (`treasury.cheque_not_available`) y su monto es el del
 * cheque.
 */
export const createPaymentOrderRequestSchema = z
	.object({
		id: treasuryIdSchema.optional(),
		supplier: z.object({
			id: contactIdSchema,
			label: z.string().max(200)
		}),
		date: isoDateSchema,
		applications: z.array(applicationSchema).max(200),
		values: z.array(paymentValueSchema).min(1).max(50),
		notes: z.string().trim().max(500).nullable(),
		openItems: z.array(openItemRefSchema).max(2000)
	})
	.superRefine((input, ctx) => {
		if (sumOf(input.values) < sumOf(input.applications))
			ctx.addIssue({
				code: 'custom',
				path: ['values'],
				message: 'Lo que se paga no alcanza para lo que se aplica.'
			})
		const cheques = input.values.flatMap(row =>
			row.chequeId ? [row.chequeId] : []
		)
		if (new Set(cheques).size !== cheques.length)
			ctx.addIssue({
				code: 'custom',
				path: ['values'],
				message: 'Un cheque se endosa una sola vez.'
			})
		const ids = input.applications.map(row => row.movementId)
		if (new Set(ids).size !== ids.length)
			ctx.addIssue({
				code: 'custom',
				path: ['applications'],
				message: 'Una factura está más de una vez.'
			})
		input.values.forEach((value, index) => {
			if (
				value.kind === 'cash' &&
				value.bills &&
				billsTotal(value.bills) !== value.amount
			)
				ctx.addIssue({
					code: 'custom',
					path: ['values', index, 'bills'],
					message: 'Los billetes no suman lo que se paga en efectivo.'
				})
		})
	})
export type CreatePaymentOrderRequest = z.output<
	typeof createPaymentOrderRequestSchema
>

/** `GET /internal/payment-orders` */
export const listPaymentOrdersQuerySchema = z.object({
	query: z.string().trim().max(80).optional(),
	supplierIds: listParam(contactIdSchema),
	delivered: booleanParam.optional(),
	dateFrom: isoDateSchema.optional(),
	dateTo: isoDateSchema.optional(),
	includeVoided: booleanParam.optional(),
	limit: z.coerce.number().int().min(1).max(1000).default(500)
})
export type ListPaymentOrdersQuery = z.output<
	typeof listPaymentOrdersQuerySchema
>
export const listPaymentOrdersResponseSchema = z.object({
	orders: z.array(paymentOrderSchema)
})
export const paymentOrderResponseSchema = z.object({
	order: paymentOrderSchema
})
export const paymentOrderDetailResponseSchema = z.object({
	order: paymentOrderSchema,
	history: z.array(historyEntrySchema)
})

/** `POST /internal/payment-orders/delivered` — «Entregar» o «Des-entregar» de a varias. */
export const setDeliveredRequestSchema = z.object({
	ids: idsSchema,
	delivered: z.boolean(),
	date: isoDateSchema
})
