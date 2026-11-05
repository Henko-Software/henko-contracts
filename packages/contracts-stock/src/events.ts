import { z } from 'zod'

import { isoDateSchema, stockIdSchema } from './common.js'
import { locationSchema } from './locations.js'
import { movementKindSchema, movementRefSchema } from './movements.js'

/**
 * Eventos de stock (stream `STOCK`, por el outbox, con el id en
 * `Nats-Msg-Id`).
 */
export const STOCK_EVENTS = {
	movementsRecorded: 'stock.movements.recorded.v1',
	countClosed: 'stock.count.closed.v1',
	locationChanged: 'stock.location.changed.v1'
} as const

/**
 * Los eventos de otros módulos que mueven stock: recepción (suma), remito
 * (resta), devolución (vuelve a la planta o a no aptos) y sus anulaciones.
 */
export const STOCK_INBOUND_EVENTS = [
	'purchases.reception.recorded.v1',
	'purchases.reception.voided.v1',
	'sales.delivery_note.created.v1',
	'sales.delivery_note.voided.v1',
	'sales.return.created.v1'
] as const

/** `stock.movements.recorded.v1` — lo que movió una operación. */
export const movementsRecordedEventSchema = z.object({
	operationId: stockIdSchema,
	date: isoDateSchema,
	ref: movementRefSchema.nullable(),
	/** La operación que esta anula (contra-movimiento). */
	reversalOf: stockIdSchema.nullable(),
	movements: z.array(
		z.object({
			id: stockIdSchema,
			kind: movementKindSchema,
			articleId: z.string(),
			locationId: z.string(),
			lot: z.string().nullable(),
			expiry: isoDateSchema.nullable(),
			quantity: z.number()
		})
	)
})
export type MovementsRecordedEvent = z.infer<
	typeof movementsRecordedEventSchema
>

/** `stock.count.closed.v1` */
export const countClosedEventSchema = z.object({
	count: z.object({
		id: stockIdSchema,
		number: z.string(),
		locationId: z.string(),
		operationId: stockIdSchema.nullable()
	})
})

/** `stock.location.changed.v1` — alta, edición, archivo: como quedó. */
export const locationChangedEventSchema = z.object({ location: locationSchema })
