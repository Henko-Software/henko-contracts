import { z } from 'zod'

import { listParam } from '@henko-software/contracts-common'

import {
	airesCodeSchema,
	contactIdSchema,
	documentNumberSchema,
	historyEntrySchema,
	isoDateSchema,
	salesIdSchema,
	vatRateSchema
} from './common.js'
import { invoiceLetterSchema } from './invoices.js'

/**
 * Devoluciones (Aires: Ventas › Devoluciones). Copia
 * `henko-web/apps/web/src/data/returns/schema.ts`: salen siempre de un
 * remito; lo que faltaba facturar se descuenta del pedido y lo ya facturado
 * va a una nota de crédito asociada a la factura (con su CAE, que pide el
 * orquestador). La cuenta corriente la imputa a la factura.
 */

export const RETURN_REASONS = [
	'shortage',
	'breakage',
	'cold_chain',
	'expired',
	'order_error'
] as const
export const returnReasonSchema = z.enum(RETURN_REASONS)
export type ReturnReason = z.infer<typeof returnReasonSchema>

/** No llegó, se tiró en el local o vuelve a la central. */
export const RETURN_DESTINATIONS = [
	'not_received',
	'destroyed',
	'back'
] as const
export const returnDestinationSchema = z.enum(RETURN_DESTINATIONS)

export const returnLineSchema = z.object({
	orderLineId: salesIdSchema,
	articleId: z.string(),
	presentationId: z.string().nullable(),
	perUnit: z.number().positive(),
	/** Presentaciones devueltas. */
	quantity: z.number().positive(),
	unitNetPrice: z.number().min(0),
	discountPct: z.number().min(0).max(100),
	vatRate: vatRateSchema,
	/** Cuánto se descontó de lo que faltaba facturar. */
	beforeInvoice: z.number().min(0),
	/** Cuánto fue a nota de crédito. */
	credited: z.number().min(0)
})

export const returnSchema = z.object({
	id: salesIdSchema,
	code: airesCodeSchema,
	date: isoDateSchema,
	localId: z.string().nullable(),
	customerId: contactIdSchema,
	deliveryPlaceId: z.string(),
	orderId: salesIdSchema,
	orderCode: airesCodeSchema,
	deliveryNote: documentNumberSchema,
	deliveryNoteDate: isoDateSchema,
	reason: returnReasonSchema,
	destination: returnDestinationSchema,
	bonusPct: z.number().min(0).max(100),
	lines: z.array(returnLineSchema).min(1),
	/** Respaldo de rotura o cadena de frío (hoy un data URL). */
	photoUrl: z.string().max(3_000_000).nullable(),
	notes: z.string().max(2000).nullable(),
	/** Las notas de crédito que generó; `number` es `null` hasta el CAE. */
	creditNotes: z.array(
		z.object({
			id: salesIdSchema,
			invoiceId: salesIdSchema,
			letter: invoiceLetterSchema,
			number: documentNumberSchema.nullable()
		})
	),
	createdAt: z.iso.datetime()
})
export type Return = z.infer<typeof returnSchema>

/** GET /internal/returns — de la más nueva a la más vieja. */
export const listReturnsQuerySchema = z.object({
	/** Código o remito. */
	query: z.string().trim().max(120).optional(),
	/** Clientes que coinciden con `query`: O con `query`. */
	queryCustomerIds: listParam(contactIdSchema),
	reasons: listParam(returnReasonSchema),
	customerIds: listParam(contactIdSchema),
	dateFrom: isoDateSchema.optional(),
	dateTo: isoDateSchema.optional()
})
export type ListReturnsQuery = z.output<typeof listReturnsQuerySchema>
export const listReturnsResponseSchema = z.object({
	returns: z.array(returnSchema)
})
/** GET /internal/returns/:id — `sales.return_not_found`. */
export const returnDetailResponseSchema = z.object({
	return: returnSchema,
	history: z.array(historyEntrySchema)
})
export const returnResponseSchema = z.object({ return: returnSchema })

/** Una línea de un remito y cuánto puede volver todavía. */
export const returnableLineSchema = z.object({
	orderLineId: salesIdSchema,
	articleId: z.string(),
	presentationId: z.string().nullable(),
	perUnit: z.number().positive(),
	unitNetPrice: z.number().min(0),
	discountPct: z.number().min(0).max(100),
	vatRate: vatRateSchema,
	delivered: z.number().min(0),
	/** Lo remitido menos lo ya devuelto o acreditado. */
	max: z.number().min(0),
	/** De `max`, cuánto falta facturar (se descuenta sin nota de crédito). */
	uninvoiced: z.number().min(0)
})

/**
 * GET /internal/customers/:id/returnable — los remitos de los últimos 30
 * días del cliente con algo para devolver.
 */
export const returnableSchema = z.object({
	orderId: salesIdSchema,
	orderCode: airesCodeSchema,
	customerId: contactIdSchema,
	deliveryPlaceId: z.string(),
	deliveryNote: documentNumberSchema,
	date: isoDateSchema,
	bonusPct: z.number().min(0).max(100),
	/** La factura del remito, si ya se facturó (la última con CAE). */
	invoice: z
		.object({
			id: salesIdSchema,
			letter: invoiceLetterSchema,
			number: documentNumberSchema.nullable()
		})
		.nullable(),
	lines: z.array(returnableLineSchema)
})
export type Returnable = z.infer<typeof returnableSchema>
export const returnableResponseSchema = z.object({
	returnable: z.array(returnableSchema)
})

/**
 * POST /internal/returns — registra la devolución y resuelve la plata, todo
 * o nada (`sales.return_exceeded`, H-DV002). Idempotente por `id`.
 */
export const createReturnRequestSchema = z.object({
	id: salesIdSchema.optional(),
	orderId: salesIdSchema,
	/** El remito del que sale (si el pedido tiene varios). */
	deliveryNote: documentNumberSchema.optional(),
	date: isoDateSchema,
	reason: returnReasonSchema,
	destination: returnDestinationSchema,
	lines: z
		.array(
			z.object({
				orderLineId: salesIdSchema,
				quantity: z.number().positive()
			})
		)
		.min(1)
		.max(500),
	photoUrl: z.string().max(3_000_000).nullable(),
	notes: z.string().max(2000).nullable()
})
export type CreateReturnRequest = z.input<typeof createReturnRequestSchema>
