import { z } from 'zod'

import { lookupCodeSchema, recordStatusSchema } from './argentina.js'
import { listParam } from './params.js'

/**
 * Tablas auxiliares abiertas de los contactos: el registro guarda el código y
 * la descripción es dato (viaja con la migración, no está en i18n). Las de
 * artículos y empleados las sirve su módulo.
 */
export const LOOKUP_TABLES = [
	'customer_types',
	'sales_channels',
	'supplier_categories'
] as const
export const lookupTableSchema = z.enum(LOOKUP_TABLES)
export type LookupTable = z.infer<typeof lookupTableSchema>

export const lookupEntrySchema = z.object({
	code: lookupCodeSchema,
	label: z.string().trim().min(1).max(80),
	/** Orden en que se muestran (como en Aires). */
	position: z.number().int().min(0),
	status: recordStatusSchema
})
export type LookupEntry = z.infer<typeof lookupEntrySchema>

/** GET /internal/lookups/:table?statuses=active — ordenadas por `position`. */
export const listLookupQuerySchema = z.object({
	statuses: listParam(recordStatusSchema)
})
export const listLookupResponseSchema = z.object({
	entries: z.array(lookupEntrySchema)
})

/** POST /internal/lookups/:table. Sin `position`, va al final. */
export const createLookupEntryRequestSchema = z.object({
	code: lookupCodeSchema,
	label: z.string().trim().min(1).max(80),
	position: z.number().int().min(0).optional()
})

/** PUT /internal/lookups/:table/:code — el código no cambia (lo guardan los registros). */
export const updateLookupEntryRequestSchema = z.object({
	label: z.string().trim().min(1).max(80),
	position: z.number().int().min(0)
})

export const lookupEntryResponseSchema = z.object({ entry: lookupEntrySchema })

/** POST /internal/lookups/:table/status — todo o nada. 204. */
export const setLookupStatusRequestSchema = z.object({
	codes: z.array(lookupCodeSchema).min(1).max(500),
	status: recordStatusSchema
})
