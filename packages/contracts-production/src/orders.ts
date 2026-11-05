import { z } from 'zod'

import { listParam } from '@henko-software/contracts-common'

import {
	actorRefSchema,
	articleIdSchema,
	historyEntrySchema,
	isoDateSchema,
	lotSchema,
	PRODUCTION_TYPES,
	productionArticleSchema,
	productionIdSchema,
	refIdSchema
} from './common.js'
import { stockLocationSchema, stockLotSchema } from './stock.js'

/**
 * Órdenes de producción (Aires: Órdenes de producción, «Procesar» y
 * «Retirar MP»). Copia `henko-web/apps/web/src/data/production/schema.ts` y
 * `henko-web/docs/back/production.md`. Cada producto es una orden para una
 * entrega; se cierra cuando sale de la cocina, con su lote.
 */

/**
 * - `open`: armada, en la cocina.
 * - `closed`: cerrada: sumó lo producido y descontó lo usado.
 * - `cancelled`: anulada antes de cerrarse.
 */
export const PRODUCTION_ORDER_STATES = ['open', 'closed', 'cancelled'] as const
export const productionOrderStateSchema = z.enum(PRODUCTION_ORDER_STATES)
export type ProductionOrderState = z.infer<typeof productionOrderStateSchema>

/** Lo que se usó de un insumo, de dónde y de qué lote. */
export const productionInputSchema = z.object({
	articleId: articleIdSchema,
	/** En la unidad de stock del insumo. */
	quantity: z.number().min(0),
	locationId: refIdSchema,
	/** `null`: del que vence primero en esa ubicación (FEFO). */
	lot: lotSchema.nullable()
})
export type ProductionInput = z.infer<typeof productionInputSchema>

export const productionOrderSchema = z.object({
	id: productionIdSchema,
	/** «009301». */
	number: z.string().regex(/^\d{6}$/),
	articleId: articleIdSchema,
	type: z.enum(PRODUCTION_TYPES),
	/** Para qué entrega se produce. */
	deliveryDate: isoDateSchema,
	/** Lo que se mandó a producir, en la unidad de stock. */
	planned: z.number().positive(),
	state: productionOrderStateSchema,
	createdAt: z.iso.datetime(),
	createdBy: actorRefSchema,
	/** Al cerrar: cuánto salió de verdad. */
	produced: z.number().min(0).nullable(),
	/** El lote (la fecha de elaboración, CAA 6.5) y su vencimiento. */
	lot: lotSchema.nullable(),
	expiry: isoDateSchema.nullable(),
	/** Dónde quedó lo producido. */
	locationId: refIdSchema.nullable(),
	inputs: z.array(productionInputSchema),
	/** El día de elaboración (hora de Argentina) y el instante del cierre. */
	closedOn: isoDateSchema.nullable(),
	closedAt: z.iso.datetime().nullable(),
	closedBy: actorRefSchema.nullable(),
	cancelledAt: z.iso.datetime().nullable()
})
export type ProductionOrder = z.infer<typeof productionOrderSchema>

/** GET /internal/orders. Orden: entrega, número. */
export const listOrdersQuerySchema = z.object({
	deliveryFrom: isoDateSchema.optional(),
	deliveryTo: isoDateSchema.optional(),
	states: listParam(productionOrderStateSchema),
	articleIds: listParam(articleIdSchema)
})
export type ListOrdersQuery = z.output<typeof listOrdersQuerySchema>

export const listOrdersResponseSchema = z.object({
	orders: z.array(productionOrderSchema)
})

/** GET /internal/orders/:id */
export const orderDetailResponseSchema = z.object({
	order: productionOrderSchema,
	history: z.array(historyEntrySchema)
})

/** POST /internal/orders/:id/close · /cancel · PUT /internal/orders/:id */
export const orderResponseSchema = z.object({ order: productionOrderSchema })

/**
 * POST /internal/orders: arma las órdenes de un plan, una por producto. Los
 * artículos los trae quien llama (catalog): uno que no se produce es
 * `production.article_not_producible`.
 */
export const createOrdersRequestSchema = z.object({
	deliveryDate: isoDateSchema,
	rows: z
		.array(
			z.object({ articleId: articleIdSchema, quantity: z.number().positive() })
		)
		.min(1)
		.max(500),
	articles: z.array(productionArticleSchema).max(500)
})
export type CreateOrdersRequest = z.input<typeof createOrdersRequestSchema>

export const createOrdersResponseSchema = listOrdersResponseSchema

/** PUT /internal/orders/:id: corregir lo mandado mientras está abierta. */
export const updateOrderRequestSchema = z.object({
	planned: z.number().positive()
})
export type UpdateOrderRequest = z.infer<typeof updateOrderRequestSchema>

/**
 * POST /internal/orders/:id/close. Lo que trae quien llama:
 * - `article`: el producto (vida útil y tipo, de catalog);
 * - `locations`: las ubicaciones de stock (lo producido va a la de su
 *   tipo de guardado);
 * - `lots`: lo que hay de cada lote de los insumos (stock), para frenar un
 *   lote elegido que no tiene tanto (`production.lot_short`).
 */
export const closeOrderRequestSchema = z.object({
	produced: z.number().positive(),
	inputs: z.array(productionInputSchema).max(200),
	article: productionArticleSchema,
	locations: z.array(stockLocationSchema).max(500),
	lots: z.array(stockLotSchema).max(5000)
})
export type CloseOrderRequest = z.input<typeof closeOrderRequestSchema>
