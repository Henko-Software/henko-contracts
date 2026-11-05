import { z } from 'zod'

import { articleIdSchema, purchasingIdSchema } from './common.js'

/**
 * Eventos de purchasing (stream `PURCHASES`, por el outbox, con el id en
 * `Nats-Msg-Id`). Lo que va a la cuenta corriente del proveedor sale con
 * los de `@henko-software/contracts-ledger`
 * (`purchases.document.recorded.v1` y `purchases.document.voided.v1`).
 */
export const PURCHASING_EVENTS = {
	orderCreated: 'purchases.order.created.v1',
	orderUpdated: 'purchases.order.updated.v1',
	orderStatusChanged: 'purchases.order.status_changed.v1',
	receptionRecorded: 'purchases.reception.recorded.v1',
	receptionVoided: 'purchases.reception.voided.v1',
	invoiceAccepted: 'purchases.invoice.accepted.v1',
	invoiceClaimResolved: 'purchases.invoice.claim_resolved.v1',
	invoiceVoided: 'purchases.invoice.voided.v1',
	documentRecorded: 'purchases.document.recorded.v1',
	documentVoided: 'purchases.document.voided.v1'
} as const

/** Lo que viaja de un pedido: sin renglones. */
export const purchaseOrderEventSchema = z.object({
	order: z.object({
		id: purchasingIdSchema,
		number: z.string(),
		localId: z.string().nullable(),
		supplierId: z.uuid(),
		deliveryDate: z.string(),
		sentAt: z.string().nullable(),
		closedShortAt: z.string().nullable(),
		invoicedAt: z.string().nullable(),
		cancelledAt: z.string().nullable(),
		version: z.number().int()
	})
})

/** `purchases.reception.recorded.v1` · `.voided.v1`: lo aceptado (stock y lotes). */
export const receptionEventSchema = z.object({
	reception: z.object({
		id: purchasingIdSchema,
		number: z.string(),
		purchaseOrderId: purchasingIdSchema,
		supplierId: z.uuid(),
		localId: z.string().nullable(),
		date: z.string(),
		lines: z.array(
			z.object({
				articleId: articleIdSchema,
				accepted: z.number(),
				lot: z.string().nullable(),
				expiry: z.string().nullable()
			})
		)
	})
})

/**
 * `purchases.invoice.accepted.v1`: el precio facturado de cada insumo. Lo
 * puede consumir catalog para pasar el costo a mano al precio facturado.
 * `.claim_resolved.v1` · `.voided.v1` llevan la misma forma.
 */
export const purchaseInvoiceEventSchema = z.object({
	invoice: z.object({
		id: purchasingIdSchema,
		supplierId: z.uuid(),
		purchaseOrderId: purchasingIdSchema.nullable(),
		date: z.string(),
		total: z.number().int(),
		lines: z.array(
			z.object({
				articleId: articleIdSchema,
				quantity: z.number(),
				unitPrice: z.number().int()
			})
		)
	})
})
