import { z } from 'zod'

import {
	actorRefSchema,
	articleIdSchema,
	booleanParam,
	isoDateSchema,
	listParam,
	locationIdSchema,
	lotSchema,
	positiveQuantitySchema,
	quantitySchema,
	stockIdSchema
} from './common.js'

/**
 * Movimientos y existencias. El stock no se carga: sale de los movimientos
 * (`henko-web/docs/back/stock.md`). Un movimiento no se edita: se corrige
 * con un contra-movimiento (`reversalOf`), que anula la operación entera.
 */

/**
 * De dónde sale cada movimiento:
 * - `opening`: el saldo con el que arrancó (migrado de Aires).
 * - `reception`: una recepción de un proveedor (purchasing).
 * - `production`: lo que salió de una orden de producción.
 * - `consumption`: lo que usó una orden de producción.
 * - `dispatch`: un remito (sales).
 * - `return`: una devolución que vuelve a la planta (sales).
 * - `transfer`: de una ubicación a otra.
 * - `adjustment`: un ajuste a mano o un conteo, con motivo.
 */
export const MOVEMENT_KINDS = [
	'opening',
	'reception',
	'production',
	'consumption',
	'dispatch',
	'return',
	'transfer',
	'adjustment'
] as const
export const movementKindSchema = z.enum(MOVEMENT_KINDS)
export type MovementKind = z.infer<typeof movementKindSchema>

/** Por qué se ajusta (Aires: «Defectuoso», «Inventario» y la observación). */
export const ADJUST_REASONS = [
	'damaged',
	'expired',
	'count',
	'sample',
	'unrecorded',
	'other'
] as const
export const adjustReasonSchema = z.enum(ADJUST_REASONS)
export type AdjustReason = z.infer<typeof adjustReasonSchema>

export const REF_KINDS = [
	'reception',
	'deliveryNote',
	'productionOrder',
	'count',
	'recall',
	'return'
] as const
export const refKindSchema = z.enum(REF_KINDS)

/** El comprobante que originó el movimiento. */
export const movementRefSchema = z.object({
	kind: refKindSchema,
	id: z.string().min(1).max(60),
	/** Para mostrarlo sin buscarlo: «000412», «0001-00102797». */
	number: z.string().max(40)
})
export type MovementRef = z.infer<typeof movementRefSchema>

/** De qué lote salió (o a cuál entró) un movimiento: FEFO si vino sin lote. */
export const movementPieceSchema = z.object({
	lot: z.string().nullable(),
	expiry: isoDateSchema.nullable(),
	quantity: quantitySchema
})
export type MovementPiece = z.infer<typeof movementPieceSchema>

export const stockMovementSchema = z.object({
	id: stockIdSchema,
	/** Todo lo que se movió junto (una transferencia, un remito, una orden). */
	operationId: stockIdSchema,
	date: isoDateSchema,
	kind: movementKindSchema,
	articleId: articleIdSchema,
	locationId: locationIdSchema,
	/** En una salida puede venir vacío: se descuenta del que vence primero. */
	lot: z.string().nullable(),
	expiry: isoDateSchema.nullable(),
	/** En la unidad de stock del artículo: positivo entra, negativo sale. */
	quantity: quantitySchema,
	reason: adjustReasonSchema.nullable(),
	note: z.string().max(200).nullable(),
	ref: movementRefSchema.nullable(),
	/** El movimiento que este anula (contra-movimiento). */
	reversalOf: stockIdSchema.nullable(),
	actor: actorRefSchema,
	recordedAt: z.iso.datetime(),
	/** Sólo si se pidió `withPieces`: de qué lotes salió. */
	pieces: z.array(movementPieceSchema).optional()
})
export type StockMovement = z.infer<typeof stockMovementSchema>

/** Lo que hay de un lote de un artículo en una ubicación. */
export const lotBalanceSchema = z.object({
	articleId: articleIdSchema,
	locationId: locationIdSchema,
	/** `null`: salió más de lo que había con lote (queda en negativo). */
	lot: z.string().nullable(),
	expiry: isoDateSchema.nullable(),
	quantity: quantitySchema
})
export type LotBalance = z.infer<typeof lotBalanceSchema>

/** Lo que viene en camino: un pedido a un proveedor que todavía no llegó. */
export const incomingSchema = z.object({
	date: isoDateSchema,
	quantity: quantitySchema,
	purchaseOrderId: z.string().min(1).max(60),
	orderNumber: z.string().max(40)
})
export type Incoming = z.infer<typeof incomingSchema>

export const STOCK_STATES = ['short', 'expiring', 'ok'] as const
export const stockStateSchema = z.enum(STOCK_STATES)
export type StockState = z.infer<typeof stockStateSchema>

/** El resumen de un artículo (`StockItem` del front). */
export const stockItemSchema = z.object({
	articleId: articleIdSchema,
	quantity: quantitySchema,
	locations: z.array(
		z.object({ locationId: locationIdSchema, quantity: quantitySchema })
	),
	lots: z.array(lotBalanceSchema),
	dailyUsage: quantitySchema,
	coverDays: z.number().nullable(),
	runsOutOn: isoDateSchema.nullable(),
	incoming: z.array(incomingSchema),
	expiring: quantitySchema,
	nextExpiry: isoDateSchema.nullable(),
	state: stockStateSchema
})
export type StockItem = z.infer<typeof stockItemSchema>

/**
 * `POST /internal/stock/query` — los artículos con stock propio. Lo que viene
 * en camino lo trae quien llama (el BFF, de purchasing): stock no llama a
 * otros módulos. `articleIds` suma artículos aunque no tengan movimientos.
 */
export const stockQueryRequestSchema = z.object({
	articleIds: z.array(articleIdSchema).max(5000).optional(),
	locationIds: z.array(locationIdSchema).max(200).optional(),
	states: z.array(stockStateSchema).max(3).optional(),
	incoming: z
		.array(incomingSchema.extend({ articleId: articleIdSchema }))
		.max(5000)
		.default([])
})
export type StockQueryRequest = z.output<typeof stockQueryRequestSchema>
export const stockQueryResponseSchema = z.object({
	items: z.array(stockItemSchema)
})

/** `POST /internal/stock/detail` — un artículo y sus movimientos de 30 días. */
export const stockDetailRequestSchema = z.object({
	articleId: articleIdSchema,
	incoming: z.array(incomingSchema).max(500).default([])
})
export const stockDetailResponseSchema = z.object({
	item: stockItemSchema,
	/** Los últimos 30 días, del más nuevo al más viejo. */
	movements: z.array(stockMovementSchema)
})

/**
 * `GET /internal/lots?articleIds=&locationIds=&includeUnavailable=` — lo que
 * hay por lote, del que vence primero al último. Para elegir qué consumir
 * (producción) y para la trazabilidad. Sin `includeUnavailable`, no cuenta
 * desperdicio ni retenido.
 */
export const listLotsQuerySchema = z.object({
	articleIds: listParam(articleIdSchema),
	locationIds: listParam(locationIdSchema),
	includeUnavailable: booleanParam.optional()
})
export type ListLotsQuery = z.output<typeof listLotsQuerySchema>
export const listLotsResponseSchema = z.object({
	lots: z.array(lotBalanceSchema)
})

/**
 * `GET /internal/movements` — con `withPieces`, cada movimiento dice de qué
 * lotes salió (FEFO): es la base de la trazabilidad. `lots` filtra por
 * pieza (un remito sin lote aparece si se llevó algo de ese lote).
 */
export const listMovementsQuerySchema = z.object({
	ids: listParam(stockIdSchema),
	operationIds: listParam(stockIdSchema),
	articleIds: listParam(articleIdSchema),
	locationIds: listParam(locationIdSchema),
	kinds: listParam(movementKindSchema),
	refKinds: listParam(refKindSchema),
	refIds: listParam(z.string().min(1).max(60)),
	lots: listParam(lotSchema),
	from: isoDateSchema.optional(),
	to: isoDateSchema.optional(),
	withPieces: booleanParam.optional(),
	limit: z.coerce.number().int().min(1).max(5000).default(1000)
})
export type ListMovementsQuery = z.output<typeof listMovementsQuerySchema>
export const listMovementsResponseSchema = z.object({
	movements: z.array(stockMovementSchema)
})
export const movementsResponseSchema = z.object({
	operationId: stockIdSchema,
	movements: z.array(stockMovementSchema)
})

/** Mover de una ubicación a otra, de un lote (o del que vence primero). */
export const transferInputSchema = z
	.object({
		articleId: articleIdSchema,
		lot: lotSchema.nullable(),
		fromId: locationIdSchema,
		toId: locationIdSchema,
		quantity: positiveQuantitySchema,
		note: z.string().trim().max(200).nullable(),
		/** Sin fecha, hoy. */
		date: isoDateSchema.optional()
	})
	.refine(input => input.fromId !== input.toId, {
		path: ['toId'],
		message: 'Elegí otra ubicación.'
	})
export type TransferInput = z.output<typeof transferInputSchema>
/**
 * `POST /internal/transfers` — `stock.insufficient` si en el origen no hay
 * tanto. Con un `id` (de operación) que ya existe, 200 con lo que hay. Con
 * `ref` de un retiro (`recall`, desde 0.2.0) la hace producción (el
 * orquestador): pide `production.write` en vez de `stock.write`.
 */
export const createTransferRequestSchema = z.object({
	id: stockIdSchema.optional(),
	transfer: transferInputSchema,
	ref: movementRefSchema
		.refine(ref => ref.kind === 'recall', {
			message: 'Sólo un retiro mueve con comprobante.'
		})
		.optional()
})

/** Sumar o restar en una ubicación, con motivo. */
export const adjustmentInputSchema = z
	.object({
		articleId: articleIdSchema,
		locationId: locationIdSchema,
		lot: lotSchema.nullable(),
		expiry: isoDateSchema.nullable(),
		/** Positivo suma, negativo resta. */
		quantity: quantitySchema.refine(value => value !== 0, {
			message: 'Tiene que ser distinto de cero.'
		}),
		reason: adjustReasonSchema,
		note: z.string().trim().max(200).nullable(),
		date: isoDateSchema.optional()
	})
	.refine(input => input.reason !== 'other' || Boolean(input.note), {
		path: ['note'],
		message: 'Contá qué pasó.'
	})
export type AdjustmentInput = z.output<typeof adjustmentInputSchema>
/** `POST /internal/adjustments` — `stock.insufficient` si se resta más de lo que hay. */
export const createAdjustmentRequestSchema = z.object({
	id: stockIdSchema.optional(),
	adjustment: adjustmentInputSchema
})

/**
 * `POST /internal/operations/:id/void` — contra-movimiento de una
 * transferencia o un ajuste a mano (lo que generó otro módulo se anula con
 * su evento: recepción anulada, remito anulado, orden anulada). Cada salida
 * vuelve al lote del que salió.
 */
export const voidOperationRequestSchema = z.object({
	date: isoDateSchema,
	reason: z.string().trim().min(1).max(120)
})

/**
 * `POST /internal/production-postings` — lo que movió una orden de
 * producción, todo junto y en una transacción: lo consumido (de un lote, o
 * del que vence primero) y lo producido (lote nuevo). El `id` es el de la
 * operación y la hace idempotente: repetirlo devuelve lo mismo.
 * `stock.insufficient` si se consume más de lo que hay, salvo
 * `allowNegative` (queda en negativo y sin lote, a la vista).
 */
export const productionPostingRequestSchema = z
	.object({
		id: stockIdSchema,
		date: isoDateSchema,
		ref: movementRefSchema.refine(ref => ref.kind === 'productionOrder', {
			message: 'Tiene que ser una orden de producción.'
		}),
		consumed: z
			.array(
				z.object({
					articleId: articleIdSchema,
					/** Sin ubicación, la del artículo (o la de cocina por defecto). */
					locationId: locationIdSchema.nullable(),
					lot: lotSchema.nullable(),
					quantity: positiveQuantitySchema
				})
			)
			.max(500),
		produced: z
			.array(
				z.object({
					articleId: articleIdSchema,
					locationId: locationIdSchema.nullable(),
					lot: lotSchema,
					expiry: isoDateSchema.nullable(),
					quantity: positiveQuantitySchema
				})
			)
			.max(100),
		allowNegative: z.boolean().default(false)
	})
	.refine(input => input.consumed.length + input.produced.length > 0, {
		message: 'No mueve nada.'
	})
export type ProductionPostingRequest = z.output<
	typeof productionPostingRequestSchema
>
/** `POST /internal/production-postings/:id/void` — vuelve todo atrás. */
export const voidProductionPostingRequestSchema = voidOperationRequestSchema
