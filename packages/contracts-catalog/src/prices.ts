import { z } from 'zod'

import { listParam } from '@henko-software/contracts-common'

import { vatRateSchema } from './articles.js'
import {
	actorRefSchema,
	catalogIdSchema,
	lookupCodeSchema,
	partIdSchema
} from './common.js'
import { discountScaleSchema } from './discountScales.js'

/**
 * Precios de las listas, con vigencia (Aires: Listas › Precios). Copia
 * `henko-web/apps/web/src/data/prices/schema.ts` y
 * `henko-web/docs/back/prices.md`.
 *
 * Una **cadena** es lista + destino (artículo o agrupamiento) +
 * presentación: el que rige hoy, los anteriores y los programados. Cada
 * escritura devuelve un `PriceChange` que se puede deshacer.
 */

export const priceTargetSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('article'), articleId: catalogIdSchema }),
	z.object({ kind: z.literal('group'), groupId: catalogIdSchema })
])
export type PriceTarget = z.infer<typeof priceTargetSchema>

export const priceChainSchema = z.object({
	target: priceTargetSchema,
	/** `null` = la unidad de stock, o un agrupamiento. */
	presentationId: partIdSchema.nullable()
})
export type PriceChain = z.infer<typeof priceChainSchema>

/**
 * Centavos sin IVA con hasta dos decimales de centavo (Aires guarda cuatro
 * de peso): 95.041,32 centavos + 21 % = $ 1.150.
 */
export const netCentsSchema = z.number().min(0).max(1e12)

export const priceSchema = z.object({
	id: catalogIdSchema,
	priceListId: catalogIdSchema,
	target: priceTargetSchema,
	presentationId: partIdSchema.nullable(),
	netPrice: netCentsSchema,
	/** «Precio fijo x UA» de Aires (qué hace: pregunta abierta). */
	fixedPerUnit: z.boolean(),
	/** «Costo U.P.», centavos sin IVA con decimales de centavo. */
	unitCost: netCentsSchema.nullable(),
	validFrom: z.iso.datetime(),
	/** `null` = sin límite. Excluyente: rige mientras `at < validTo`. */
	validTo: z.iso.datetime().nullable(),
	updatedAt: z.iso.datetime(),
	/** Quién lo cargó; oculto si fue un superadmin y quien mira no lo es. */
	updatedBy: actorRefSchema
})
export type Price = z.infer<typeof priceSchema>

/** GET /internal/prices?priceListIds= — vigentes, programados y anteriores. */
export const listPricesQuerySchema = z.object({
	priceListIds: listParam(catalogIdSchema)
})
export const listPricesResponseSchema = z.object({
	prices: z.array(priceSchema)
})

/**
 * GET /internal/price-lists/:id/prices/history?kind=&targetId=&presentationId=
 * — la cadena, del más nuevo al más viejo (por `validFrom`).
 */
export const priceHistoryQuerySchema = z.object({
	kind: z.enum(['article', 'group']),
	targetId: catalogIdSchema,
	presentationId: partIdSchema.optional()
})

/** Cargar o programar un precio. `validFrom: null` = desde ahora. */
export const priceScheduleInputSchema = z.object({
	priceListId: catalogIdSchema,
	target: priceTargetSchema,
	presentationId: partIdSchema.nullable(),
	netPrice: netCentsSchema,
	fixedPerUnit: z.boolean(),
	unitCost: netCentsSchema.nullable(),
	validFrom: z.iso.datetime().nullable(),
	/** `null` = hasta el próximo programado de la cadena, o sin límite. */
	validTo: z.iso.datetime().nullable()
})
export type PriceScheduleInput = z.infer<typeof priceScheduleInputSchema>

/** POST /internal/prices/schedule */
export const schedulePricesRequestSchema = z.object({
	items: z.array(priceScheduleInputSchema).min(1).max(2000)
})

/** PATCH /internal/prices/:id — corrige sin crear otro (también corta la vigencia). */
export const priceUpdateInputSchema = priceScheduleInputSchema.pick({
	netPrice: true,
	fixedPerUnit: true,
	unitCost: true,
	validTo: true
})
export type PriceUpdateInput = z.infer<typeof priceUpdateInputSchema>

/** POST /internal/prices/remove — todo o nada; el anterior vuelve a regir. */
export const removePricesRequestSchema = z.object({
	ids: z.array(catalogIdSchema).min(1).max(2000)
})

export const ROUNDINGS = ['none', '10', '50', '100'] as const
export const roundingSchema = z.enum(ROUNDINGS)
export type Rounding = z.infer<typeof roundingSchema>

/** POST /internal/prices/increase[/preview] — aumento (o baja) masivo. */
export const bulkIncreaseInputSchema = z.object({
	priceListId: catalogIdSchema,
	percent: z.number().min(-90).max(500),
	validFrom: z.iso.datetime().nullable(),
	rounding: roundingSchema,
	scope: z.discriminatedUnion('kind', [
		z.object({ kind: z.literal('all') }),
		z.object({ kind: z.literal('category'), category: lookupCodeSchema }),
		z.object({
			kind: z.literal('targets'),
			targets: z.array(priceChainSchema).min(1).max(5000)
		})
	])
})
export type BulkIncreaseInput = z.infer<typeof bulkIncreaseInputSchema>

export const bulkIncreasePreviewSchema = z.object({
	rows: z.array(
		z.object({
			target: priceTargetSchema,
			presentationId: partIdSchema.nullable(),
			beforeNet: z.number(),
			/** `null` = agrupamiento con IVA mixto: el aumento va al neto, sin redondeo. */
			beforeFinal: z.number().nullable(),
			afterNet: z.number(),
			afterFinal: z.number().nullable()
		})
	),
	skipped: z.number().int().min(0),
	excludedMixedCategory: z.number().int().min(0)
})
export type BulkIncreasePreview = z.infer<typeof bulkIncreasePreviewSchema>

/** Horas en que un cambio de precios se puede deshacer (decisión asumida 1). */
export const PRICE_CHANGE_UNDO_HOURS = 24

/** Un cambio hecho, para deshacerlo con `POST /internal/prices/changes/:id/revert`. */
export const priceChangeSchema = z.object({
	id: catalogIdSchema,
	count: z.number().int().min(0),
	at: z.iso.datetime(),
	/**
	 * Hasta cuándo se puede deshacer (`at` + `PRICE_CHANGE_UNDO_HOURS`). Un
	 * cambio posterior en alguna de sus listas lo cierra antes.
	 */
	revertibleUntil: z.iso.datetime()
})
export type PriceChange = z.infer<typeof priceChangeSchema>

export const priceChangeResponseSchema = z.object({ change: priceChangeSchema })

// ---------- Precio que rige (para Ventas y el orquestador)

/**
 * POST /internal/prices/resolve — el precio que rige para cada renglón en
 * una lista y un momento. Regla: el precio del artículo (en su
 * presentación) gana; si no tiene, el del primer agrupamiento de
 * `article.groups` con `prices: true` que tenga precio a esa fecha. La
 * lista del cliente la sabe quien llama (contacts); con `customerId`
 * vuelven además sus bonificaciones por escala activas.
 */
export const resolvePricesRequestSchema = z.object({
	priceListId: catalogIdSchema,
	customerId: z.uuid().nullable().default(null),
	/** `null` = ahora. */
	at: z.iso.datetime().nullable().default(null),
	items: z
		.array(
			z.object({
				articleId: catalogIdSchema,
				presentationId: partIdSchema.nullable()
			})
		)
		.min(1)
		.max(500)
})
export type ResolvePricesRequest = z.input<typeof resolvePricesRequestSchema>

export const RESOLVE_MISSES = [
	/** El artículo no existe, está dado de baja o no se vende. */
	'article_unavailable',
	/** La presentación no es del artículo o está dada de baja. */
	'presentation_unavailable',
	/** Ni el artículo ni sus agrupamientos tienen precio a esa fecha. */
	'no_price'
] as const

export const resolvedPriceSchema = z.object({
	articleId: catalogIdSchema,
	presentationId: partIdSchema.nullable(),
	/** `null` = no se le puede vender (ver `miss`). */
	price: z
		.object({
			priceId: catalogIdSchema,
			/** De dónde sale: el artículo o un agrupamiento. */
			source: priceTargetSchema,
			netPrice: z.number(),
			vatRate: vatRateSchema,
			/** Final con IVA, centavos enteros. */
			finalPrice: z.number().int(),
			fixedPerUnit: z.boolean(),
			unitCost: z.number().nullable(),
			validFrom: z.iso.datetime(),
			validTo: z.iso.datetime().nullable()
		})
		.nullable(),
	miss: z.enum(RESOLVE_MISSES).nullable()
})
export type ResolvedPrice = z.infer<typeof resolvedPriceSchema>

export const resolvePricesResponseSchema = z.object({
	at: z.iso.datetime(),
	items: z.array(resolvedPriceSchema),
	/** Las escalas activas que incluyen al cliente; quién las aplica lo decide Ventas. */
	discountScales: z.array(discountScaleSchema)
})

/**
 * `catalog.prices.changed.v1` (stream `CATALOG`): cambió algún precio de
 * esas listas (cargar, corregir, sacar, aumento, copia o deshacer).
 */
export const pricesChangedEventSchema = z.object({
	changeId: catalogIdSchema,
	operation: z.enum([
		'schedule',
		'update',
		'remove',
		'increase',
		'copy',
		'revert'
	]),
	priceListIds: z.array(catalogIdSchema),
	count: z.number().int().min(0)
})
export const PRICES_CHANGED_EVENT = 'catalog.prices.changed.v1'
