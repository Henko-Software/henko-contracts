import { z } from 'zod'

import { listParam } from '@henko-software/contracts-common'

import { lookupCodeSchema, recordStatusSchema } from './common.js'

/**
 * Tablas auxiliares abiertas del catálogo (Aires: «Categoría» y «Envase»).
 * El artículo guarda el código; la descripción es dato (viaja con la
 * migración). Misma forma y mismas rutas que las de contacts
 * (`contracts-contacts/lookups`), así el BFF las sirve iguales.
 */
export const CATALOG_LOOKUP_TABLES = [
	'article_categories',
	'containers'
] as const
export const catalogLookupTableSchema = z.enum(CATALOG_LOOKUP_TABLES)
export type CatalogLookupTable = z.infer<typeof catalogLookupTableSchema>

export const catalogLookupEntrySchema = z.object({
	code: lookupCodeSchema,
	label: z.string().trim().min(1).max(80),
	/** Orden en que se muestran (como en Aires). */
	position: z.number().int().min(0),
	status: recordStatusSchema
})
export type CatalogLookupEntry = z.infer<typeof catalogLookupEntrySchema>

/** GET /internal/lookups/:table?statuses=active — por `position`. Sin `statuses`, las activas. */
export const listCatalogLookupQuerySchema = z.object({
	statuses: listParam(recordStatusSchema)
})
export const listCatalogLookupResponseSchema = z.object({
	entries: z.array(catalogLookupEntrySchema)
})

/** POST /internal/lookups/:table. Sin `position`, va al final. */
export const createCatalogLookupRequestSchema = z.object({
	code: lookupCodeSchema,
	label: z.string().trim().min(1).max(80),
	position: z.number().int().min(0).optional()
})

/** PUT /internal/lookups/:table/:code — el código no cambia (lo guardan los artículos). */
export const updateCatalogLookupRequestSchema = z.object({
	label: z.string().trim().min(1).max(80),
	position: z.number().int().min(0)
})

export const catalogLookupEntryResponseSchema = z.object({
	entry: catalogLookupEntrySchema
})

/** POST /internal/lookups/:table/status — todo o nada. 204. */
export const setCatalogLookupStatusRequestSchema = z.object({
	codes: z.array(lookupCodeSchema).min(1).max(500),
	status: recordStatusSchema
})
