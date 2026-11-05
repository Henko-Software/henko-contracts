import { z } from 'zod'

import {
	articleIdSchema,
	isoDateSchema,
	lotSchema,
	quantitySchema,
	refIdSchema
} from './common.js'

/**
 * Lo que production lee del stock (`stock`), con la forma de
 * `henko-web/apps/web/src/data/stock/schema.ts`. Production no guarda stock:
 * lo trae quien llama (el BFF, de stock) y lo que production mueve sale por
 * evento (`production.order.closed.v1`, `production.recall.started.v1`) y
 * lo anota stock.
 */

/** Qué es cada ubicación. `hold`: lo retenido por un retiro (no disponible). */
export const LOCATION_KINDS = [
	'frozen',
	'chilled',
	'raw',
	'dry',
	'kitchen',
	'expedition',
	'waste',
	'hold'
] as const
export const locationKindSchema = z.enum(LOCATION_KINDS)

/** Una ubicación física (Aires: «U.F.»): una cámara o un depósito de una sede. */
export const stockLocationSchema = z.object({
	id: refIdSchema,
	site: z.string().max(120),
	name: z.string().max(120),
	kind: locationKindSchema
})
export type StockLocation = z.infer<typeof stockLocationSchema>

/** Lo que hay de un lote de un artículo en una ubicación. */
export const lotBalanceSchema = z.object({
	articleId: articleIdSchema,
	locationId: refIdSchema,
	/** `null`: salió más de lo que había con lote (queda en negativo). */
	lot: lotSchema.nullable(),
	expiry: isoDateSchema.nullable(),
	quantity: quantitySchema
})
export type LotBalance = z.infer<typeof lotBalanceSchema>

export const MOVEMENT_KINDS = [
	'opening',
	'reception',
	'production',
	'consumption',
	'dispatch',
	'transfer',
	'adjustment',
	'return'
] as const
export const movementKindSchema = z.enum(MOVEMENT_KINDS)
export type MovementKind = z.infer<typeof movementKindSchema>

export const MOVEMENT_REF_KINDS = [
	'reception',
	'deliveryNote',
	'productionOrder',
	'count',
	'recall',
	'return',
	'transfer'
] as const

/** El comprobante que originó el movimiento. */
export const movementRefSchema = z.object({
	kind: z.enum(MOVEMENT_REF_KINDS),
	id: refIdSchema,
	/** Para mostrarlo sin buscarlo: «000412», «0001-00102797». */
	number: z.string().max(40)
})
export type MovementRef = z.infer<typeof movementRefSchema>

/**
 * Un movimiento de stock, como lo mira la trazabilidad. Positivo entra,
 * negativo sale; una salida sin lote se parte en los lotes que vencen
 * primero (FEFO).
 */
export const traceMovementSchema = z.object({
	id: refIdSchema,
	date: isoDateSchema,
	kind: movementKindSchema,
	articleId: articleIdSchema,
	locationId: refIdSchema,
	lot: lotSchema.nullable(),
	expiry: isoDateSchema.nullable(),
	quantity: quantitySchema,
	ref: movementRefSchema.nullable()
})
export type TraceMovement = z.infer<typeof traceMovementSchema>

/** Lo que viene en camino: un pedido a un proveedor que todavía no llegó (purchasing). */
export const incomingSchema = z.object({
	articleId: articleIdSchema,
	date: isoDateSchema,
	quantity: z.number().min(0),
	purchaseOrderId: refIdSchema,
	orderNumber: z.string().max(40)
})
export type Incoming = z.infer<typeof incomingSchema>

/**
 * Lo que production le pide a stock que anote, en una transacción e
 * idempotente por `id` (lo genera production). Viaja en los eventos.
 */
export const stockMoveSchema = z.object({
	id: z.uuid(),
	date: isoDateSchema,
	kind: z.enum(['production', 'consumption', 'transfer']),
	articleId: articleIdSchema,
	locationId: refIdSchema,
	/** En una salida, `null` = FEFO en esa ubicación (puede quedar en negativo). */
	lot: lotSchema.nullable(),
	expiry: isoDateSchema.nullable(),
	quantity: quantitySchema,
	note: z.string().max(200).nullable(),
	ref: movementRefSchema
})
export type StockMove = z.infer<typeof stockMoveSchema>
