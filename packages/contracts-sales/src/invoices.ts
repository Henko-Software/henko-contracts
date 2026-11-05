import { z } from 'zod'

import { discountScaleSchema } from '@henko-software/contracts-catalog'
import { booleanParam, listParam } from '@henko-software/contracts-common'
import { arcaMessageSchema } from '@henko-software/contracts-fiscal'

import {
	airesCodeSchema,
	contactIdSchema,
	docTypeSchema,
	documentNumberSchema,
	historyEntrySchema,
	isoDateSchema,
	salesIdSchema,
	vatConditionSchema,
	vatRateSchema
} from './common.js'

/**
 * Facturas, notas de crédito y de débito de venta. Copia
 * `henko-web/apps/web/src/data/invoices/schema.ts` y suma lo de la
 * autorización: sales arma el comprobante, el orquestador le pide el CAE a
 * fiscal y lo vuelve a anotar acá (`/authorization`). Mientras tanto la
 * factura está «pendiente de CAE» y sin número.
 */

export const INVOICE_KINDS = ['invoice', 'credit_note', 'debit_note'] as const
export const invoiceKindSchema = z.enum(INVOICE_KINDS)
export const INVOICE_LETTERS = ['A', 'B', 'C', 'E'] as const
export const invoiceLetterSchema = z.enum(INVOICE_LETTERS)
export const CREDIT_REASONS = [
	'return',
	'shortage',
	'breakage',
	'cold_chain',
	'expired',
	'price',
	'other'
] as const
export const creditReasonSchema = z.enum(CREDIT_REASONS)
export const INVOICE_STATUSES = ['active', 'cancelled'] as const
export const invoiceStatusSchema = z.enum(INVOICE_STATUSES)

/**
 * - `pending`: pedido a fiscal, todavía sin respuesta (o fiscal caído: se
 *   reintenta).
 * - `authorized`: con CAE. `contingency`: con CAEA (ARCA no respondía).
 * - `rejected`: ARCA lo rechazó; la factura queda anulada y lo facturado
 *   vuelve al pedido.
 */
export const AUTHORIZATION_STATUSES = [
	'pending',
	'authorized',
	'contingency',
	'rejected'
] as const
export const authorizationStatusSchema = z.enum(AUTHORIZATION_STATUSES)
export type AuthorizationStatus = z.infer<typeof authorizationStatusSchema>

export const invoiceLineSchema = z.object({
	id: salesIdSchema,
	orderId: salesIdSchema.nullable(),
	orderLineId: salesIdSchema.nullable(),
	orderCode: airesCodeSchema.nullable(),
	deliveryNote: documentNumberSchema.nullable(),
	articleId: z.string(),
	presentationId: z.string().nullable(),
	perUnit: z.number().positive(),
	quantity: z.number().positive(),
	unitNetPrice: z.number().min(0),
	discountPct: z.number().min(0).max(100),
	vatRate: vatRateSchema,
	sourceLineId: salesIdSchema.nullable()
})
export type InvoiceLine = z.infer<typeof invoiceLineSchema>

/** Lo que sales sabe del receptor, como estaba al facturar. */
export const receiverSchema = z.object({
	vatCondition: vatConditionSchema,
	docType: docTypeSchema.nullable(),
	docNumber: z.string().max(20)
})

export const invoiceSchema = z.object({
	id: salesIdSchema,
	localId: z.string().nullable(),
	kind: invoiceKindSchema,
	letter: invoiceLetterSchema,
	pointOfSale: z.number().int().min(1),
	/** `null` mientras no tiene autorización (lo da fiscal). */
	number: documentNumberSchema.nullable(),
	date: isoDateSchema,
	dueDate: isoDateSchema,
	customerId: contactIdSchema,
	deliveryPlaceId: z.string().nullable(),
	zone: z.string().nullable(),
	receiver: receiverSchema,
	paymentTermId: z.uuid(),
	salespersonId: contactIdSchema.nullable(),
	priceListId: z.string().min(1).max(60),
	bonusPct: z.number().min(0).max(100),
	/** De dónde sale la bonificación: la del pedido y la de la escala del mes. */
	bonus: z.object({
		orderPct: z.number().min(0).max(100),
		scalePct: z.number().min(0).max(100),
		scaleId: z.uuid().nullable()
	}),
	lines: z.array(invoiceLineSchema).min(1),
	totals: z.object({
		net: z.number().int(),
		vat: z.number().int(),
		total: z.number().int()
	}),
	cae: z
		.object({
			number: z.string().regex(/^\d{14}$/),
			dueDate: isoDateSchema
		})
		.nullable(),
	authorization: z.object({
		status: authorizationStatusSchema,
		type: z.enum(['CAE', 'CAEA']).nullable(),
		errors: z.array(arcaMessageSchema),
		/** Cuántas veces se pidió (el alta y cada reintento). */
		requests: z.number().int().min(0),
		updatedAt: z.iso.datetime()
	}),
	relatedInvoiceId: salesIdSchema.nullable(),
	creditReason: creditReasonSchema.nullable(),
	notes: z.string().max(2000).nullable(),
	sent: z.array(
		z.object({
			channel: z.enum(['email', 'whatsapp']),
			at: z.iso.datetime()
		})
	),
	status: invoiceStatusSchema,
	version: z.number().int().min(1),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime()
})
export type Invoice = z.infer<typeof invoiceSchema>

/** GET /internal/invoices */
export const listInvoicesQuerySchema = z.object({
	/** Número del comprobante. */
	query: z.string().trim().max(120).optional(),
	/** Clientes que coinciden con `query` (nombre, CUIT): O con `query`. */
	queryCustomerIds: listParam(contactIdSchema),
	kinds: listParam(invoiceKindSchema),
	statuses: listParam(invoiceStatusSchema),
	authorizations: listParam(authorizationStatusSchema),
	unsent: booleanParam.optional(),
	dateFrom: isoDateSchema.optional(),
	dateTo: isoDateSchema.optional(),
	customerIds: listParam(contactIdSchema),
	limit: z.coerce.number().int().min(1).max(2000).default(500)
})
export type ListInvoicesQuery = z.output<typeof listInvoicesQuerySchema>
export const listInvoicesResponseSchema = z.object({
	invoices: z.array(invoiceSchema)
})
export const invoiceResponseSchema = z.object({ invoice: invoiceSchema })
/** GET /internal/invoices/:id — con sus notas asociadas e historial. */
export const invoiceDetailResponseSchema = z.object({
	invoice: invoiceSchema,
	related: z.array(invoiceSchema),
	history: z.array(historyEntrySchema)
})

/** GET /internal/invoices/pending — lo remitido sin facturar, por pedido. */
export const pendingInvoicingSchema = z.object({
	orderId: salesIdSchema,
	orderCode: airesCodeSchema,
	customerId: contactIdSchema,
	deliveryDate: isoDateSchema,
	deliveryNotes: z.array(documentNumberSchema),
	/** Con IVA y bonificación del pedido, centavos. */
	total: z.number().int()
})
export const pendingInvoicingResponseSchema = z.object({
	pending: z.array(pendingInvoicingSchema)
})

/**
 * Lo que sales necesita del cliente para facturarle (lo arma quien llama
 * con contacts y catalog).
 */
export const customerBillingSchema = z.object({
	customerId: contactIdSchema,
	/** `vatCondition: null` = no se le puede facturar (RG 5616). */
	receiver: z.object({
		vatCondition: vatConditionSchema.nullable(),
		docType: docTypeSchema.nullable(),
		docNumber: z.string().max(20).nullable()
	}),
	priceListId: z.string().min(1).max(60),
	/** Días hasta el vencimiento (el último de su condición de pago). */
	paymentTermDays: z.number().int().min(0).max(365),
	/** Bonificaciones por escala activas que lo incluyen (catalog). */
	discountScales: z.array(discountScaleSchema).default([])
})
export type CustomerBilling = z.input<typeof customerBillingSchema>

/**
 * POST /internal/invoices/from-orders — una factura por pedido con lo
 * remitido sin facturar. Todo o nada: `sales.nothing_to_invoice` (H-FC002),
 * `sales.receiver_not_valid` (H-FC004). Cada factura sale «pendiente de
 * CAE» y su pedido de autorización va por el outbox
 * (`sales.invoice.authorization_requested.v1`).
 */
export const invoiceOrdersRequestSchema = z.object({
	orderIds: z.array(salesIdSchema).min(1).max(200),
	date: isoDateSchema,
	customers: z.array(customerBillingSchema).min(1).max(200)
})
export type InvoiceOrdersRequest = z.input<typeof invoiceOrdersRequestSchema>

/** POST /internal/invoices/:id/credit-notes — `sales.credit_exceeded` (H-FC003). */
export const creditNoteRequestSchema = z.object({
	lines: z
		.array(z.object({ lineId: salesIdSchema, quantity: z.number().positive() }))
		.min(1)
		.max(500),
	reason: creditReasonSchema,
	notes: z.string().max(2000).nullable(),
	date: isoDateSchema.optional()
})
export type CreditNoteRequest = z.input<typeof creditNoteRequestSchema>

/** POST /internal/invoices/sent — 204. Con `email`, sólo se anota (falta el envío). */
export const markSentRequestSchema = z.object({
	ids: z.array(salesIdSchema).min(1).max(500),
	channel: z.enum(['email', 'whatsapp'])
})

/**
 * POST /internal/invoices/:id/authorization — lo anota el orquestador con
 * lo que respondió fiscal. Idempotente: la misma respuesta dos veces no
 * cambia nada; una factura ya autorizada no se pisa.
 */
export const recordAuthorizationRequestSchema = z.discriminatedUnion('status', [
	z.object({
		status: z.enum(['authorized', 'contingency']),
		type: z.enum(['CAE', 'CAEA']),
		code: z.string().regex(/^\d{14}$/),
		dueDate: isoDateSchema,
		/** El punto de venta con el que salió (el de CAEA en contingencia). */
		pointOfSale: z.number().int().min(1).max(99998),
		number: z.number().int().min(1).max(99999999)
	}),
	z.object({
		status: z.literal('rejected'),
		errors: z.array(arcaMessageSchema)
	})
])
export type RecordAuthorizationRequest = z.input<
	typeof recordAuthorizationRequestSchema
>

/** POST /internal/invoices/:id/retry-authorization — vuelve a pedir el CAE de una pendiente (`sales.invoice_not_pending`). */
export const retryAuthorizationResponseSchema = invoiceResponseSchema
