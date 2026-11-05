import { z } from 'zod'

import { listParam } from '@henko-software/contracts-common'

import {
	airesCodeSchema,
	catalogIdSchema,
	recordStatusSchema
} from './common.js'

/**
 * Agrupamientos de artículos (Aires: Administración › Agrupamientos) y
 * listas de precios (Aires: Administración › Listas). Los dos son «nombre y
 * código»; los miembros de un agrupamiento viven en el artículo
 * (`article.groups`) y los precios de una lista, aparte (`prices.ts`).
 */

export const articleGroupSchema = z.object({
	id: catalogIdSchema,
	code: airesCodeSchema,
	name: z.string().trim().min(1).max(60),
	status: recordStatusSchema,
	version: z.number().int().min(1),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime()
})
export type ArticleGroup = z.infer<typeof articleGroupSchema>

/** GET /internal/article-groups. Orden: nombre (es). Busca en código y nombre. */
export const listNamedQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	statuses: listParam(recordStatusSchema)
})
export type ListNamedQuery = z.output<typeof listNamedQuerySchema>

export const listArticleGroupsResponseSchema = z.object({
	groups: z.array(articleGroupSchema)
})

/**
 * POST /internal/article-groups (con `id` repetido devuelve el que hay) ·
 * PUT /internal/article-groups/:id. El nombre no se repite (sin tildes ni
 * mayúsculas, contra todos, también los dados de baja).
 */
export const articleGroupRequestSchema = z.object({
	id: catalogIdSchema.optional(),
	name: z.string().trim().min(1).max(60)
})

export const articleGroupResponseSchema = z.object({
	group: articleGroupSchema
})

export const priceListSchema = z.object({
	id: catalogIdSchema,
	code: airesCodeSchema,
	name: z.string().trim().min(1).max(80),
	status: recordStatusSchema,
	/** Último cambio de un precio de la lista (no del nombre). Al crearla, la fecha de alta. */
	pricesUpdatedAt: z.iso.datetime(),
	version: z.number().int().min(1),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime()
})
export type PriceList = z.infer<typeof priceListSchema>

/** GET /internal/price-lists. Orden: nombre (es). Busca en código y nombre. */
export const listPriceListsResponseSchema = z.object({
	priceLists: z.array(priceListSchema)
})

/**
 * POST /internal/price-lists · PUT /internal/price-lists/:id. El nombre no
 * se repite contra las activas (sin tildes ni mayúsculas).
 */
export const priceListRequestSchema = z.object({
	id: catalogIdSchema.optional(),
	name: z.string().trim().min(1).max(80)
})

export const priceListResponseSchema = z.object({ priceList: priceListSchema })

/** Eventos de agrupamientos y listas (stream `CATALOG`). */
export const articleGroupEventSchema = z.object({
	group: articleGroupSchema.pick({
		id: true,
		code: true,
		name: true,
		status: true,
		version: true
	})
})
export const ARTICLE_GROUP_EVENT_TYPES = [
	'catalog.article_group.created.v1',
	'catalog.article_group.updated.v1',
	'catalog.article_group.archived.v1',
	'catalog.article_group.restored.v1'
] as const

export const priceListEventSchema = z.object({
	priceList: priceListSchema.pick({
		id: true,
		code: true,
		name: true,
		status: true,
		version: true
	})
})
export const PRICE_LIST_EVENT_TYPES = [
	'catalog.price_list.created.v1',
	'catalog.price_list.updated.v1',
	'catalog.price_list.archived.v1',
	'catalog.price_list.restored.v1'
] as const
