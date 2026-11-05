import { z } from 'zod'

import {
	ADJUST_REASONS,
	adjustmentInputSchema,
	articleIdSchema,
	articleSettingsInputSchema,
	articleSettingsSchema,
	COUNT_STATES,
	countLineSchema,
	isoDateSchema,
	listParam,
	LOCATION_STATUSES,
	locationIdSchema,
	locationInputSchema,
	locationKindSchema,
	MOVEMENT_KINDS,
	movementRefSchema,
	reviewLineSchema,
	stockItemSchema,
	stockStateSchema,
	transferInputSchema,
	voidOperationRequestSchema
} from '@henko-software/contracts-stock'

/**
 * Producción y stock (`/production/stock`, `/production/counts`), armado
 * con `stock`. Las formas copian `henko-web/apps/web/src/data/{stock,counts}/schema.ts`:
 * el BFF pone el nombre de quien movió o contó (vacío si fue un superadmin
 * y quien mira no lo es), filtra por lo que dice catalog del artículo y le
 * trae a stock lo que viene en camino (purchasing).
 */

// ---------- Stock (flag `production.stock`)

/** Una ubicación (`StockLocation` del front). */
export const bffStockLocationSchema = z.object({
	id: z.string(),
	site: z.string(),
	name: z.string(),
	kind: locationKindSchema
})
export const listBffStockLocationsQuerySchema = z.object({
	statuses: listParam(z.enum(LOCATION_STATUSES))
})
export const listBffStockLocationsResponseSchema = z.object({
	locations: z.array(bffStockLocationSchema)
})
export const bffStockLocationResponseSchema = z.object({
	location: bffStockLocationSchema
})
/** POST /api/stock/locations · PUT /api/stock/locations/:id */
export const bffStockLocationInputSchema = locationInputSchema
/** POST /api/stock/locations/status — archivar (sin stock) o recuperar. */
export const bffSetStockLocationsStatusBodySchema = z.object({
	ids: z.array(locationIdSchema).min(1).max(200),
	status: z.enum(LOCATION_STATUSES)
})

/** Un movimiento (`StockMovement` del front, con `return` y la operación). */
export const bffStockMovementSchema = z.object({
	id: z.string(),
	/** Para anular una transferencia o un ajuste a mano. */
	operationId: z.string(),
	date: isoDateSchema,
	kind: z.enum(MOVEMENT_KINDS),
	articleId: z.string(),
	locationId: z.string(),
	lot: z.string().nullable(),
	expiry: isoDateSchema.nullable(),
	quantity: z.number(),
	reason: z.enum(ADJUST_REASONS).nullable(),
	note: z.string().max(200).nullable(),
	ref: movementRefSchema.nullable(),
	/** Quién lo hizo (los automáticos, el módulo; vacío si no se puede ver). */
	user: z.string()
})
export type BffStockMovement = z.infer<typeof bffStockMovementSchema>

/** GET /api/stock?query=&states=&kinds=&locationIds= */
export const listBffStockQuerySchema = z.object({
	query: z.string().trim().max(80).optional(),
	states: listParam(stockStateSchema),
	/** Tipos de artículo de catalog (`raw_material`, `finished`…). */
	kinds: listParam(z.string().min(1).max(40)),
	locationIds: listParam(locationIdSchema)
})
export const listBffStockResponseSchema = z.object({
	items: z.array(stockItemSchema)
})
/** GET /api/stock/:articleId — `H-NOTFOUND` si no lleva stock. */
export const bffStockDetailResponseSchema = z.object({
	item: stockItemSchema,
	/** Los últimos 30 días, del más nuevo al más viejo. */
	movements: z.array(bffStockMovementSchema)
})

/** POST /api/stock/transfers (204) — `H-ST002` = `stock.insufficient`. */
export const bffTransferInputSchema = transferInputSchema
/** POST /api/stock/adjustments (204) — `H-ST002` = `stock.insufficient`. */
export const bffAdjustmentInputSchema = adjustmentInputSchema
/** POST /api/stock/operations/:id/void (204) — contra-movimiento. */
export const bffVoidStockOperationBodySchema = voidOperationRequestSchema

/** GET /api/stock/article-settings · PUT /api/stock/article-settings/:articleId */
export const bffArticleStockSettingsSchema = articleSettingsSchema
export const bffArticleStockSettingsInputSchema = articleSettingsInputSchema
export const listBffArticleStockSettingsResponseSchema = z.object({
	settings: z.array(articleSettingsSchema)
})
export const bffArticleStockSettingsResponseSchema = z.object({
	settings: articleSettingsSchema
})

// ---------- Conteos (flag `production.counts`)

/** Un conteo (`StockCount` del front). */
export const bffStockCountSchema = z.object({
	id: z.string(),
	number: z.string(),
	locationId: z.string(),
	state: z.enum(COUNT_STATES),
	startedAt: isoDateSchema,
	startedBy: z.string(),
	closedAt: isoDateSchema.nullable(),
	closedBy: z.string().nullable(),
	lines: z.array(countLineSchema)
})
export type BffStockCount = z.infer<typeof bffStockCountSchema>
export const listBffCountsResponseSchema = z.object({
	counts: z.array(bffStockCountSchema)
})
export const bffCountResponseSchema = z.object({ count: bffStockCountSchema })
/** POST /api/counts — si ya hay uno en curso ahí, devuelve ese. */
export const bffStartCountBodySchema = z.object({
	locationId: locationIdSchema
})
/** PUT /api/counts/:id/lines/:articleId — `H-CO003` = `stock.count_not_open`. */
export const bffCountEntrySchema = z.object({
	articleId: articleIdSchema,
	counted: z.number().min(0).nullable()
})
/** GET /api/counts/:id/review */
export const bffReviewCountResponseSchema = z.object({
	lines: z.array(reviewLineSchema)
})
