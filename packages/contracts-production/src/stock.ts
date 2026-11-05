import { z } from 'zod'

import {
	incomingSchema,
	locationSchema,
	lotBalanceSchema,
	movementRefSchema,
	stockMovementSchema
} from '@henko-software/contracts-stock'

import { articleIdSchema, isoDateSchema, lotSchema } from './common.js'

/**
 * Lo que production lee del stock, con las formas de
 * `@henko-software/contracts-stock` (no se duplica nada de stock).
 * Production no guarda stock: lo trae quien llama (el BFF, de stock) y lo
 * que production mueve sale por evento (`production.order.closed.v1`,
 * `production.recall.started.v1`) y lo anota stock por el orquestador
 * (`POST /internal/production-postings` y `POST /internal/transfers`).
 */

/** Una ubicación de stock: production mira su `kind` (lo producido, lo retenido). */
export const stockLocationSchema = locationSchema.pick({
	id: true,
	site: true,
	name: true,
	kind: true
})
export type StockLocation = z.infer<typeof stockLocationSchema>

/** Lo que hay de un lote de un artículo en una ubicación (`GET /internal/lots`). */
export const stockLotSchema = lotBalanceSchema
export type StockLot = z.infer<typeof stockLotSchema>

/** El comprobante que originó un movimiento de stock. */
export const stockRefSchema = movementRefSchema
export type StockRef = z.infer<typeof stockRefSchema>

/**
 * Un movimiento de stock como lo mira la trazabilidad (`GET
 * /internal/movements`; lo demás se descarta). Positivo entra, negativo
 * sale; una salida sin lote se parte en los lotes que vencen primero.
 */
export const traceMovementSchema = stockMovementSchema.pick({
	id: true,
	date: true,
	kind: true,
	articleId: true,
	locationId: true,
	lot: true,
	expiry: true,
	quantity: true,
	ref: true
})
export type TraceMovement = z.infer<typeof traceMovementSchema>

/** Lo que viene en camino de un artículo: un pedido a un proveedor (purchasing). */
export const incomingLineSchema = incomingSchema.extend({
	articleId: articleIdSchema
})
export type IncomingLine = z.infer<typeof incomingLineSchema>

/**
 * Lo que produjo o usó una orden, para stock. `consumption` con `lot:
 * null` = del que vence primero en esa ubicación (puede quedar en
 * negativo). Con `ref: { kind: 'productionOrder' }`.
 */
export const productionMoveSchema = z.object({
	kind: z.enum(['production', 'consumption']),
	articleId: articleIdSchema,
	locationId: z.string().min(1).max(40),
	lot: lotSchema.nullable(),
	expiry: isoDateSchema.nullable(),
	/** Positivo: siempre la cantidad que entra o sale. */
	quantity: z.number().positive()
})
export type ProductionMove = z.infer<typeof productionMoveSchema>

/** Lo que un retiro pasa a la ubicación `hold`: una transferencia por lote y ubicación. */
export const holdTransferSchema = z.object({
	/** El id de la operación de stock (idempotente). */
	id: z.uuid(),
	articleId: articleIdSchema,
	lot: lotSchema,
	fromId: z.string().min(1).max(40),
	toId: z.string().min(1).max(40),
	quantity: z.number().positive()
})
export type HoldTransfer = z.infer<typeof holdTransferSchema>
