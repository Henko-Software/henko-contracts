import { z } from 'zod'

import { voucherInputSchema } from '@henko-software/contracts-fiscal'

import { salesIdSchema } from './common.js'

/**
 * Eventos de sales (stream `SALES`, por el outbox, con el id en
 * `Nats-Msg-Id`). Lo que va a la cuenta corriente sale con los de
 * `@henko-software/contracts-ledger` (`sales.document.issued.v1` y
 * `sales.document.voided.v1`), una vez que el comprobante tiene CAE.
 */
export const SALES_EVENTS = {
	orderCreated: 'sales.order.created.v1',
	orderUpdated: 'sales.order.updated.v1',
	orderStatusChanged: 'sales.order.status_changed.v1',
	dispatched: 'sales.route_sheet.dispatched.v1',
	invoiceAuthorizationRequested: 'sales.invoice.authorization_requested.v1',
	invoiceAuthorized: 'sales.invoice.authorized.v1',
	invoiceRejected: 'sales.invoice.rejected.v1',
	documentIssued: 'sales.document.issued.v1',
	documentVoided: 'sales.document.voided.v1'
} as const

/** Lo que viaja de un pedido: sin líneas ni importes. */
export const orderEventSchema = z.object({
	order: z.object({
		id: salesIdSchema,
		code: z.string(),
		localId: z.string().nullable(),
		customerId: z.uuid(),
		deliveryDate: z.string(),
		status: z.enum(['open', 'closed', 'cancelled']),
		version: z.number().int()
	})
})

/** `sales.route_sheet.dispatched.v1` */
export const routeSheetDispatchedEventSchema = z.object({
	routeSheet: z.object({
		id: salesIdSchema,
		code: z.string(),
		deliveryDate: z.string(),
		deliveryNotes: z.array(z.string())
	})
})

/**
 * `sales.invoice.authorization_requested.v1` — una factura o nota armada
 * que necesita CAE (al emitirla y en cada reintento). Lo consume el
 * orquestador (flujo `sales.invoice_authorization`): `voucher` va tal cual
 * a `POST /internal/vouchers` de fiscal, con el id de la factura como id
 * del comprobante (idempotencia en fiscal).
 */
export const invoiceAuthorizationRequestedEventSchema = z.object({
	invoiceId: salesIdSchema,
	voucher: voucherInputSchema
})
export type InvoiceAuthorizationRequestedEvent = z.input<
	typeof invoiceAuthorizationRequestedEventSchema
>

/** `sales.invoice.authorized.v1` · `sales.invoice.rejected.v1` */
export const invoiceEventSchema = z.object({
	invoice: z.object({
		id: salesIdSchema,
		kind: z.enum(['invoice', 'credit_note', 'debit_note']),
		letter: z.enum(['A', 'B', 'C', 'E']),
		number: z.string().nullable(),
		customerId: z.uuid(),
		localId: z.string().nullable(),
		total: z.number().int(),
		authorization: z.enum(['pending', 'authorized', 'contingency', 'rejected'])
	})
})
