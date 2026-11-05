import { z } from 'zod'

import {
	articleIdSchema,
	isoDateSchema,
	purchasingIdSchema,
	supplierIdSchema
} from './common.js'

/**
 * Precios de insumos (Compras › Precios de insumos): lo que se pagó por
 * cada insumo según las facturas de compra aceptadas (sin las anuladas).
 * Copia `henko-web/apps/web/src/data/purchase_invoices/prices.ts`
 * (`inputPrices`), que antes lo calculaba el front.
 */

/** Cuántos días mira el cambio de precio. */
export const PRICE_WINDOW_DAYS = 30

/** Un precio facturado: por la unidad de compra, en centavos sin IVA. */
export const pricePointSchema = z.object({
	date: isoDateSchema,
	price: z.number().int().min(0),
	supplierId: supplierIdSchema,
	invoiceId: purchasingIdSchema
})
export type PricePoint = z.infer<typeof pricePointSchema>

export const inputPriceSchema = z.object({
	articleId: articleIdSchema,
	/** El último precio facturado y de quién. */
	last: pricePointSchema,
	/**
	 * Contra qué se compara: el último precio de hace 30 días o más; si no
	 * hay, el primero de todos. `null` si hay un solo precio.
	 */
	previous: pricePointSchema.nullable(),
	/** Cuánto cambió, en % con un decimal; `null` sin con qué comparar. */
	changePct: z.number().nullable(),
	/** Los precios de los últimos `days` días, del más viejo al más nuevo. */
	points: z.array(pricePointSchema)
})
export type InputPrice = z.infer<typeof inputPriceSchema>

/**
 * GET /internal/purchase-prices?days=90 — el precio de cada insumo
 * facturado. `today` (Argentina) lo pone purchasing si no viene.
 */
export const purchasePricesQuerySchema = z.object({
	days: z.coerce.number().int().min(1).max(730).default(90),
	today: isoDateSchema.optional()
})
export type PurchasePricesQuery = z.output<typeof purchasePricesQuerySchema>

export const purchasePricesResponseSchema = z.object({
	prices: z.array(inputPriceSchema)
})
