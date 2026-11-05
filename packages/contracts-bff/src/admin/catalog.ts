import { z } from 'zod'

import {
	articleCostChangeSchema,
	articleFieldsSchema,
	articleGroupSchema,
	articlePhotoRequestSchema,
	articleSchema,
	bulkIncreaseInputSchema,
	bulkIncreasePreviewSchema,
	discountScaleFieldsSchema,
	discountScaleSchema,
	listArticlesQuerySchema,
	listDiscountScalesQuerySchema,
	listNamedQuerySchema,
	listPricesQuerySchema,
	priceChangeSchema,
	priceHistoryQuerySchema,
	priceListSchema,
	priceScheduleInputSchema,
	priceSchema,
	priceUpdateInputSchema
} from '@henko-software/contracts-catalog'

/**
 * Catálogo y precios (`/admin/articles`, `/admin/article-groups`,
 * `/admin/price-lists`, `/admin/discount-scales`), armados con `catalog`.
 * Las formas copian `henko-web/apps/web/src/data/{articles,article_groups,
 * price_lists,prices,discount_scales}/schema.ts`: lo de `catalog` sin lo
 * interno (`version`, fechas de alta) y el autor de un precio con nombre.
 */

// ---------- Artículos (flag `products.articles`)

/**
 * La foto: una URL de afuera, un `data:` URL (lo de antes) o la ruta del BFF
 * a la foto guardada en catalog (`/api/articles/:id/photo?v=…`, mismo origen
 * que el front).
 */
export const bffPhotoUrlSchema = z
	.string()
	.max(300_000)
	.refine(
		value =>
			/^\/api\/articles\/[^/?#]+\/photo(\?v=\d+)?$/.test(value) ||
			z.url().safeParse(value).success,
		{ message: 'URL de la foto inválida' }
	)

/** `photoUrl` ya resuelto por el BFF (la foto guardada gana); sin `photo`. */
export const bffArticleSchema = articleSchema
	.omit({
		version: true,
		createdAt: true,
		updatedAt: true,
		photo: true
	})
	.extend({ photoUrl: bffPhotoUrlSchema.nullable() })
export type BffArticle = z.infer<typeof bffArticleSchema>

/**
 * POST /api/articles · PUT /api/articles/:id: `ArticleInput` del front. Si
 * `photoUrl` es la ruta de la foto guardada, la foto queda como está.
 */
export const articleInputSchema = articleFieldsSchema.extend({
	photoUrl: bffPhotoUrlSchema.nullable()
})
export type ArticleInput = z.input<typeof articleInputSchema>

/**
 * PUT /api/articles/:id/photo → `{ article }`: la imagen en base64 (el
 * front la achica antes). DELETE /api/articles/:id/photo → `{ article }`.
 * GET /api/articles/:id/photo → la imagen (bytes, con su `Content-Type`).
 */
export const articlePhotoBodySchema = articlePhotoRequestSchema
export type ArticlePhotoBody = z.infer<typeof articlePhotoBodySchema>

/** GET /api/articles?query=&statuses=&kinds=&categories=&usage=&groupIds= */
export const listBffArticlesQuerySchema = listArticlesQuerySchema

/** GET /api/articles · GET /api/articles/:id/used-in */
export const listArticlesBffResponseSchema = z.object({
	articles: z.array(bffArticleSchema)
})
/** GET /api/articles/:id · POST · PUT · POST /api/articles/:id/duplicate */
export const articleBffResponseSchema = z.object({ article: bffArticleSchema })

/**
 * Un cambio del costo de un insumo por una factura de compra: lo de catalog
 * con el nombre de quien aceptó o anuló (vacío si fue un superadmin y quien
 * mira no lo es).
 */
export const bffArticleCostChangeSchema = articleCostChangeSchema
	.omit({ actor: true })
	.extend({ user: z.string() })
export type BffArticleCostChange = z.infer<typeof bffArticleCostChangeSchema>

/** GET /api/articles/:id/cost-history — del más nuevo al más viejo. */
export const articleCostHistoryBffResponseSchema = z.object({
	changes: z.array(bffArticleCostChangeSchema)
})

// GET /api/articles/:id/history → `historyResponseSchema` (common).
// POST /api/articles/status → `setStatusBodySchema` (common). 204.

// ---------- Agrupamientos (flag `settings.articleGroups`)

export const bffArticleGroupSchema = articleGroupSchema.pick({
	id: true,
	code: true,
	name: true,
	status: true
})
export type BffArticleGroup = z.infer<typeof bffArticleGroupSchema>

/** POST /api/article-groups · PUT /api/article-groups/:id */
export const articleGroupInputSchema = z.object({
	name: z.string().trim().min(1).max(60)
})

/** GET /api/article-groups?query=&statuses= (también listas de precios). */
export const listNamedBffQuerySchema = listNamedQuerySchema

export const listArticleGroupsBffResponseSchema = z.object({
	articleGroups: z.array(bffArticleGroupSchema)
})
export const articleGroupBffResponseSchema = z.object({
	articleGroup: bffArticleGroupSchema
})

// ---------- Listas de precios y precios (flag `products.priceLists`)

export const bffPriceListSchema = priceListSchema.pick({
	id: true,
	code: true,
	name: true,
	status: true,
	pricesUpdatedAt: true,
	isBase: true
})
export type BffPriceList = z.infer<typeof bffPriceListSchema>

/**
 * POST /api/price-lists · PUT /api/price-lists/:id. Dar de baja una lista
 * que tiene clientes activos responde `bff.price_list_in_use`.
 */
export const priceListInputSchema = z.object({
	name: z.string().trim().min(1).max(80),
	/** `true` la hace la lista principal (desmarca la anterior). */
	isBase: z.boolean().optional()
})

export const listPriceListsBffResponseSchema = z.object({
	priceLists: z.array(bffPriceListSchema)
})
export const priceListBffResponseSchema = z.object({
	priceList: bffPriceListSchema
})

/**
 * Un precio como lo ve el front: `updatedBy` es el nombre de quien lo cargó
 * (vacío si fue un superadmin y quien mira no lo es).
 */
export const bffPriceSchema = priceSchema.extend({ updatedBy: z.string() })
export type BffPrice = z.infer<typeof bffPriceSchema>

/** GET /api/prices?priceListIds= */
export const listBffPricesQuerySchema = listPricesQuerySchema
export const listPricesBffResponseSchema = z.object({
	prices: z.array(bffPriceSchema)
})

/** GET /api/price-lists/:id/prices/history?kind=&targetId=&presentationId= */
export const priceHistoryBffQuerySchema = priceHistoryQuerySchema

/** POST /api/prices/schedule */
export const schedulePricesBodySchema = z.object({
	items: z.array(priceScheduleInputSchema).min(1).max(2000)
})
/** PATCH /api/prices/:id */
export const priceUpdateBodySchema = priceUpdateInputSchema
/** POST /api/prices/remove */
export const removePricesBodySchema = z.object({
	ids: z.array(z.uuid()).min(1).max(2000)
})
/** POST /api/prices/increase y /api/prices/increase/preview */
export const bulkIncreaseBodySchema = bulkIncreaseInputSchema
export const bulkIncreasePreviewBffResponseSchema = bulkIncreasePreviewSchema

/**
 * Toda escritura de precios (schedule, PATCH, remove, increase, copy-from)
 * responde el cambio, para deshacerlo con
 * `POST /api/prices/changes/:id/revert` (204).
 */
export const priceChangeBffResponseSchema = z.object({
	change: priceChangeSchema
})

// ---------- Bonificaciones por escala (flag `products.discountScales`)

export const bffDiscountScaleSchema = discountScaleSchema.omit({
	version: true,
	createdAt: true
})
export type BffDiscountScale = z.infer<typeof bffDiscountScaleSchema>

/** POST /api/discount-scales · PUT /api/discount-scales/:id */
export const discountScaleInputSchema = discountScaleFieldsSchema
export type DiscountScaleInput = z.input<typeof discountScaleInputSchema>

/** GET /api/discount-scales?query=&statuses=&units= */
export const listBffDiscountScalesQuerySchema =
	listDiscountScalesQuerySchema.omit({ customerIds: true })

export const listDiscountScalesBffResponseSchema = z.object({
	discountScales: z.array(bffDiscountScaleSchema)
})
/** GET /:id · POST · PUT · POST /api/discount-scales/:id/duplicate */
export const discountScaleBffResponseSchema = z.object({
	discountScale: bffDiscountScaleSchema
})
