import { z } from 'zod'

import { articleEventSchema } from '@henko-software/contracts-catalog'
import {
	purchaseInvoiceEventSchema,
	PURCHASING_EVENTS
} from '@henko-software/contracts-purchasing'
import {
	invoiceEventSchema,
	SALES_EVENTS
} from '@henko-software/contracts-sales'

import { statementLineSchema } from './lines.js'
import { statementSourceSchema } from './statement.js'

/**
 * Lo que consume reporting (un consumidor durable por tipo, desde el
 * principio del stream, idempotente por `Nats-Msg-Id`):
 *
 * - `sales.invoice.authorized.v1`: lo facturado sin IVA por rubro de
 *   artículo (facturas y notas de débito suman, notas de crédito restan);
 * - `purchases.invoice.accepted.v1` · `.voided.v1`: lo comprado sin IVA,
 *   por el rubro de cada insumo (la anulación resta lo mismo);
 * - `purchases.document.recorded.v1` con `credit_note`: la nota de crédito
 *   de una factura de compra resta en proporción (sin IVA);
 * - `catalog.article.*.v1`: el rubro de cada artículo (para las compras).
 */
export const REPORTING_INBOUND_EVENTS = [
	SALES_EVENTS.invoiceAuthorized,
	PURCHASING_EVENTS.invoiceAccepted,
	PURCHASING_EVENTS.invoiceVoided,
	PURCHASING_EVENTS.documentRecorded,
	'catalog.article.created.v1',
	'catalog.article.updated.v1'
] as const
export type ReportingInboundEventType =
	(typeof REPORTING_INBOUND_EVENTS)[number]

export { articleEventSchema, invoiceEventSchema, purchaseInvoiceEventSchema }

/** Eventos de reporting (stream `REPORTING`, por el outbox). */
export const REPORTING_EVENTS = {
	lineChanged: 'reporting.statement_line.changed.v1',
	sourceChanged: 'reporting.statement_source.changed.v1'
} as const

/** `reporting.statement_line.changed.v1`: alta, edición, baja o recuperación. */
export const lineChangedEventSchema = z.object({ line: statementLineSchema })

/** `reporting.statement_source.changed.v1`: a qué rubro va una fuente. */
export const sourceChangedEventSchema = z.object({
	source: statementSourceSchema
})
