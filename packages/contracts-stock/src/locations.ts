import { z } from 'zod'

import {
	articleIdSchema,
	listParam,
	locationIdSchema,
	positiveQuantitySchema
} from './common.js'

/**
 * Ubicaciones (Aires: «U.F.»): una cámara o un depósito de una sede. Forma
 * de `henko-web/apps/web/src/data/stock/schema.ts` (`locationSchema`), con
 * estado y versión. El alta va en Configuración (pregunta 84).
 */

/**
 * Qué es cada ubicación: cámara de congelado, de frescos o de materia
 * prima, depósito de secos, cocina, expedición, desperdicio (lo no apto) o
 * retenido (lo que se separa por un retiro). Lo que está en `waste` y
 * `hold` no es stock disponible.
 */
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
export type LocationKind = z.infer<typeof locationKindSchema>

/** Las que no son stock disponible: no cuentan ni salen en un remito. */
export const UNAVAILABLE_LOCATION_KINDS: readonly LocationKind[] = [
	'waste',
	'hold'
]

export const LOCATION_STATUSES = ['active', 'archived'] as const
export const locationStatusSchema = z.enum(LOCATION_STATUSES)
export type LocationStatus = z.infer<typeof locationStatusSchema>

export const locationInputSchema = z.object({
	/** La sede o planta. */
	site: z.string().trim().min(1).max(60),
	name: z.string().trim().min(1).max(60),
	kind: locationKindSchema
})
export type LocationInput = z.infer<typeof locationInputSchema>

export const locationSchema = locationInputSchema.extend({
	id: locationIdSchema,
	status: locationStatusSchema,
	version: z.number().int().min(1)
})
export type Location = z.infer<typeof locationSchema>

/** `GET /internal/locations?statuses=` (sin estados: las activas). */
export const listLocationsQuerySchema = z.object({
	statuses: listParam(locationStatusSchema)
})
export type ListLocationsQuery = z.output<typeof listLocationsQuerySchema>
export const listLocationsResponseSchema = z.object({
	locations: z.array(locationSchema)
})

/** `POST /internal/locations` — con un `id` que ya existe, 200 con la que hay. */
export const createLocationRequestSchema = z.object({
	id: locationIdSchema.optional(),
	location: locationInputSchema
})
/** `PUT /internal/locations/:id` */
export const updateLocationRequestSchema = z.object({
	location: locationInputSchema,
	version: z.number().int().min(1).optional()
})
export const locationResponseSchema = z.object({ location: locationSchema })

/**
 * `POST /internal/locations/status` — archivar o recuperar, todo o nada.
 * Una ubicación con stock no se archiva (`stock.location_not_empty`).
 */
export const setLocationsStatusRequestSchema = z.object({
	ids: z.array(locationIdSchema).min(1).max(200),
	status: locationStatusSchema
})

/**
 * Lo que stock necesita saber de cada artículo y todavía no publica catalog
 * (decisión asumida): dónde se guarda (pregunta 84) y cuántas unidades de
 * stock trae la unidad de compra (`cost.purchaseQuantity` de catalog: una
 * bolsa de 25 kg = 25).
 */
export const articleSettingsInputSchema = z.object({
	locationId: locationIdSchema.nullable(),
	purchaseFactor: positiveQuantitySchema
})
export const articleSettingsSchema = articleSettingsInputSchema.extend({
	articleId: articleIdSchema
})
export type ArticleSettings = z.infer<typeof articleSettingsSchema>

/** `GET /internal/article-settings?articleIds=` — sin ids, todos los cargados. */
export const listArticleSettingsQuerySchema = z.object({
	articleIds: listParam(articleIdSchema)
})
export const listArticleSettingsResponseSchema = z.object({
	settings: z.array(articleSettingsSchema)
})
/** `PUT /internal/article-settings/:articleId` */
export const putArticleSettingsRequestSchema = z.object({
	settings: articleSettingsInputSchema
})
export const articleSettingsResponseSchema = z.object({
	settings: articleSettingsSchema
})
