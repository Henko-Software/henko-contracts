import { z } from 'zod'

import {
	articleIdSchema,
	isoDateSchema,
	lotSchema,
	productionIdSchema
} from './common.js'
import { recallKindSchema } from './recalls.js'
import { holdTransferSchema, productionMoveSchema } from './stock.js'

/**
 * Eventos de production (stream `PRODUCTION`, por el outbox, con el id en
 * `Nats-Msg-Id`). Lo que mueve el stock viaja en el evento y lo anota stock
 * por el orquestador: el cierre de una orden con
 * `POST /internal/production-postings` (id de la operación = id de la
 * orden) y lo retenido por un retiro con `POST /internal/transfers`.
 */
export const PRODUCTION_EVENTS = {
	ordersCreated: 'production.orders.created.v1',
	orderUpdated: 'production.order.updated.v1',
	orderCancelled: 'production.order.cancelled.v1',
	orderClosed: 'production.order.closed.v1',
	recallStarted: 'production.recall.started.v1',
	recallClosed: 'production.recall.closed.v1'
} as const

const orderRefSchema = z.object({
	id: productionIdSchema,
	number: z.string(),
	articleId: articleIdSchema,
	deliveryDate: isoDateSchema
})

/** `production.orders.created.v1` · `order.updated` · `order.cancelled` */
export const ordersChangedEventSchema = z.object({
	orders: z.array(orderRefSchema.extend({ planned: z.number().positive() }))
})

/**
 * `production.order.closed.v1`: lo producido (`production`, +, con su lote
 * y vencimiento) y lo usado (`consumption`, −), con
 * `ref: { kind: 'productionOrder' }`. Stock los anota en una transacción.
 */
export const orderClosedEventSchema = z.object({
	order: orderRefSchema.extend({
		produced: z.number().positive(),
		lot: lotSchema,
		expiry: isoDateSchema.nullable()
	}),
	/** El día de elaboración (hora de Argentina): la fecha de los movimientos. */
	date: isoDateSchema,
	moves: z.array(productionMoveSchema).min(1)
})
export type OrderClosedEvent = z.infer<typeof orderClosedEventSchema>

/**
 * `production.recall.started.v1`: en un retiro, lo que queda en planta pasa
 * a la ubicación `hold` (una transferencia por lote y ubicación); en un simulacro,
 * `transfers` va vacío.
 */
export const recallStartedEventSchema = z.object({
	recall: z.object({
		id: productionIdSchema,
		number: z.string(),
		kind: recallKindSchema,
		articleId: articleIdSchema,
		lot: lotSchema
	}),
	date: isoDateSchema,
	transfers: z.array(holdTransferSchema)
})
export type RecallStartedEvent = z.infer<typeof recallStartedEventSchema>

/** `production.recall.closed.v1` */
export const recallClosedEventSchema = z.object({
	recall: z.object({
		id: productionIdSchema,
		number: z.string(),
		kind: recallKindSchema,
		closedAt: z.iso.datetime()
	})
})
