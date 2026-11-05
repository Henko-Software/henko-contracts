import { z } from 'zod'

import { isoDateSchema } from '@henko-software/contracts-contacts'

import {
	ledgerDocumentSchema,
	recordDocumentCommandSchema,
	voidDocumentCommandSchema
} from './accounts.js'
import { chartAccountSchema } from './chart.js'
import {
	centsSchema,
	ledgerPartySchema,
	movementKindSchema,
	sourceModuleSchema
} from './common.js'

// ---------- Eventos que consume ledger
//
// Los publican Ventas, Compras y Tesorería (todavía no existen) por su
// outbox, con el id del evento en `Nats-Msg-Id`. `ledger` los consume con un
// consumidor durable por tipo y es idempotente por id de evento (y además
// por comprobante: el mismo `document.id` se anota una sola vez).

const documentOf = <K extends readonly [string, ...string[]]>(kinds: K) =>
	ledgerDocumentSchema.extend({ kind: z.enum(kinds) })

/** Un comprobante anulado: `ledger` lo cancela con un contra-asiento. */
export const documentVoidedEventSchema = z.object({
	documentId: z.string().min(1).max(80),
	date: isoDateSchema,
	reason: z.string().trim().max(120).nullable().default(null)
})

/** `sales.document.issued.v1` (stream `SALES`): factura, ND o NC a un cliente. */
export const salesDocumentIssuedEventSchema = z.object({
	document: documentOf(['invoice', 'debit_note', 'credit_note'] as const)
})
/** `purchases.document.recorded.v1` (stream `PURCHASES`): factura, ND o NC de un proveedor. */
export const purchasesDocumentRecordedEventSchema = z.object({
	document: documentOf(['invoice', 'debit_note', 'credit_note'] as const)
})
/** `treasury.receipt.issued.v1` (stream `TREASURY`): recibo de un cliente. */
export const treasuryReceiptIssuedEventSchema = z.object({
	document: documentOf(['receipt'] as const)
})
/** `treasury.payment_order.issued.v1` (stream `TREASURY`): orden de pago a un proveedor. */
export const treasuryPaymentOrderIssuedEventSchema = z.object({
	document: documentOf(['payment_order'] as const)
})

/**
 * `treasury.cheque.rejected.v1` (stream `TREASURY`): el banco no pagó un
 * cheque de un cliente: nota de débito al cliente por el monto (la deuda
 * vuelve a abrirse; el recibo queda como estaba).
 */
export const treasuryChequeRejectedEventSchema = z.object({
	document: documentOf(['debit_note'] as const)
})
/**
 * `treasury.cheque.returned.v1` (stream `TREASURY`): el proveedor devolvió un
 * cheque que se le endosó y fue rechazado: nota de débito del proveedor (lo
 * que se le pagó con ese cheque se le vuelve a deber).
 */
export const treasuryChequeReturnedEventSchema = z.object({
	document: documentOf(['debit_note'] as const)
})

/**
 * Lo que consume `ledger`, con de qué lado anota y de qué módulo viene. Los
 * `*.voided.v1` llevan `documentVoidedEventSchema`.
 */
export const LEDGER_INBOUND_EVENTS = {
	'sales.document.issued.v1': {
		party: 'customer',
		module: 'sales',
		schema: salesDocumentIssuedEventSchema
	},
	'sales.document.voided.v1': {
		party: 'customer',
		module: 'sales',
		schema: documentVoidedEventSchema
	},
	'purchases.document.recorded.v1': {
		party: 'supplier',
		module: 'purchases',
		schema: purchasesDocumentRecordedEventSchema
	},
	'purchases.document.voided.v1': {
		party: 'supplier',
		module: 'purchases',
		schema: documentVoidedEventSchema
	},
	'treasury.receipt.issued.v1': {
		party: 'customer',
		module: 'treasury',
		schema: treasuryReceiptIssuedEventSchema
	},
	'treasury.receipt.voided.v1': {
		party: 'customer',
		module: 'treasury',
		schema: documentVoidedEventSchema
	},
	'treasury.payment_order.issued.v1': {
		party: 'supplier',
		module: 'treasury',
		schema: treasuryPaymentOrderIssuedEventSchema
	},
	'treasury.payment_order.voided.v1': {
		party: 'supplier',
		module: 'treasury',
		schema: documentVoidedEventSchema
	},
	'treasury.cheque.rejected.v1': {
		party: 'customer',
		module: 'treasury',
		schema: treasuryChequeRejectedEventSchema
	},
	'treasury.cheque.returned.v1': {
		party: 'supplier',
		module: 'treasury',
		schema: treasuryChequeReturnedEventSchema
	}
} as const
export type LedgerInboundEventType = keyof typeof LEDGER_INBOUND_EVENTS
export const LEDGER_INBOUND_EVENT_TYPES = Object.keys(
	LEDGER_INBOUND_EVENTS
) as LedgerInboundEventType[]

/** Los comandos del orquestador, por su ruta (ver `accounts.ts`). */
export const LEDGER_COMMANDS = {
	'record-document': recordDocumentCommandSchema,
	'void-document': voidDocumentCommandSchema
} as const

// ---------- Eventos que publica ledger (stream `LEDGER`)

/** Lo que viaja de un movimiento: sin cuentas ni rubros. */
export const movementSummarySchema = z.object({
	id: z.uuid(),
	party: ledgerPartySchema,
	contactId: z.uuid(),
	kind: movementKindSchema,
	date: isoDateSchema,
	dueDate: isoDateSchema.nullable(),
	amount: centsSchema,
	source: z.object({
		module: sourceModuleSchema,
		documentId: z.string().nullable()
	}),
	reversalOf: z.uuid().nullable()
})

/** `ledger.movement.recorded.v1`: un movimiento nuevo (también un contra-asiento). */
export const movementRecordedEventSchema = z.object({
	movement: movementSummarySchema
})

/**
 * `ledger.application.recorded.v1`: una imputación (positiva) o lo que se
 * deshizo de una (negativa).
 */
export const applicationRecordedEventSchema = z.object({
	application: z.object({
		id: z.uuid(),
		party: ledgerPartySchema,
		contactId: z.uuid(),
		debitId: z.uuid(),
		creditId: z.uuid(),
		amount: centsSchema,
		date: isoDateSchema
	})
})

/**
 * `ledger.chart_account.created.v1`, `.updated.v1`, `.moved.v1`,
 * `.status_changed.v1`: la cuenta como quedó.
 */
export const chartAccountEventSchema = z.object({ account: chartAccountSchema })

export const LEDGER_EVENT_TYPES = [
	'ledger.movement.recorded.v1',
	'ledger.application.recorded.v1',
	'ledger.chart_account.created.v1',
	'ledger.chart_account.updated.v1',
	'ledger.chart_account.moved.v1',
	'ledger.chart_account.status_changed.v1'
] as const
export type LedgerEventType = (typeof LEDGER_EVENT_TYPES)[number]
