import { z } from 'zod'

import {
	articleIdSchema,
	isoDateSchema,
	lotSchema,
	refIdSchema,
	STOCK_UNITS
} from './common.js'
import { movementRefSchema, traceMovementSchema } from './stock.js'

/**
 * Trazabilidad de un lote (Aires: Trazabilidad, vacía). Copia
 * `henko-web/apps/web/src/data/traceability/rules.ts` y
 * `henko-web/docs/back/traceability.md`. Todo sale de los movimientos de
 * stock: production no guarda nada aparte, salvo los retiros.
 */

/** Lo que hace falta de un artículo para buscarlo y sumar en kilos. */
export const traceArticleSchema = z.object({
	id: articleIdSchema,
	code: z.string().max(20),
	description: z.string().max(200),
	unit: z.enum(STOCK_UNITS),
	/** El peso de una unidad (`recipe.unitWeightKg`); 0 si no se sabe. */
	unitWeightKg: z.number().min(0)
})
export type TraceArticle = z.infer<typeof traceArticleSchema>

/**
 * Lo que trae quien llama (el BFF) para la trazabilidad: los movimientos
 * de stock, el cliente de cada remito (sales), los artículos (catalog) y el
 * remito del proveedor de cada recepción (purchasing).
 */
export const traceSourceSchema = z.object({
	movements: z.array(traceMovementSchema).max(200_000),
	customers: z
		.array(z.object({ deliveryNoteId: refIdSchema, customerId: refIdSchema }))
		.max(50_000),
	articles: z.array(traceArticleSchema).max(20_000),
	receptions: z
		.array(
			z.object({ id: refIdSchema, deliveryNote: z.string().max(40).nullable() })
		)
		.max(50_000)
})
export type TraceSource = z.infer<typeof traceSourceSchema>

/** Un lote de un artículo (el mismo lote puede estar en varias ubicaciones). */
export const lotKeySchema = z.object({
	articleId: articleIdSchema,
	lot: lotSchema
})
export type LotKey = z.infer<typeof lotKeySchema>

/** Cómo entró un lote: una recepción, una orden de producción o el saldo de Aires. */
export const lotOriginSchema = z.object({
	kind: z.enum(['reception', 'production', 'opening', 'other']),
	date: isoDateSchema,
	quantity: z.number(),
	ref: movementRefSchema.nullable()
})
export type LotOrigin = z.infer<typeof lotOriginSchema>

export const lotSummarySchema = lotKeySchema.extend({
	expiry: isoDateSchema.nullable(),
	origin: lotOriginSchema
})
export type LotSummary = z.infer<typeof lotSummarySchema>

/** Sin texto, los lotes que entraron en estos días. */
export const RECENT_LOT_DAYS = 7
/** Cuántos lotes devuelve una búsqueda. */
export const LOT_SEARCH_LIMIT = 40

/** POST /internal/lots/search */
export const searchLotsRequestSchema = z.object({
	query: z.string().trim().max(120),
	source: traceSourceSchema
})
export type SearchLotsRequest = z.input<typeof searchLotsRequestSchema>
export const searchLotsResponseSchema = z.object({
	lots: z.array(lotSummarySchema)
})

export const traceInputSchema = z.object({
	articleId: articleIdSchema,
	lot: lotSchema.nullable(),
	quantity: z.number()
})
export const traceUseSchema = z.object({
	order: movementRefSchema,
	date: isoDateSchema,
	articleId: z.string(),
	lot: lotSchema.nullable(),
	quantity: z.number()
})
export const traceShipmentSchema = lotKeySchema.extend({
	deliveryNote: z.string(),
	date: isoDateSchema,
	customerId: refIdSchema,
	quantity: z.number(),
	kg: z.number()
})
export const traceHoldingSchema = lotKeySchema.extend({
	locationId: refIdSchema,
	expiry: isoDateSchema.nullable(),
	quantity: z.number(),
	kg: z.number()
})

export const lotTraceSchema = lotKeySchema.extend({
	expiry: isoDateSchema.nullable(),
	origin: lotOriginSchema.nullable(),
	/** Hacia atrás: con qué se hizo (si salió de una orden). */
	inputs: z.array(traceInputSchema),
	/** Hacia adelante: en qué órdenes se usó. */
	uses: z.array(traceUseSchema),
	/** El lote y todo lo que se hizo con él, hasta el final. */
	lots: z.array(lotKeySchema),
	/** A qué locales llegó, del más nuevo al más viejo. */
	shipments: z.array(traceShipmentSchema),
	holdings: z.array(traceHoldingSchema),
	shippedKg: z.number(),
	heldKg: z.number()
})
export type LotTrace = z.infer<typeof lotTraceSchema>

/** POST /internal/lots/trace */
export const traceLotRequestSchema = lotKeySchema.extend({
	source: traceSourceSchema
})
export type TraceLotRequest = z.input<typeof traceLotRequestSchema>
export const traceLotResponseSchema = z.object({ trace: lotTraceSchema })
