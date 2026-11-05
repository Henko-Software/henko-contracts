import { z } from 'zod'

import { lookupCodeSchema } from './common.js'

/**
 * Tablas auxiliares de empleados (abiertas en Aires): categoría,
 * departamento y tipo de jornada. El empleado guarda el código.
 */
export const PEOPLE_LOOKUP_TABLES = [
	'employee_categories',
	'departments',
	'work_schedules'
] as const
export const peopleLookupTableSchema = z.enum(PEOPLE_LOOKUP_TABLES)

export const peopleLookupEntrySchema = z.object({
	code: lookupCodeSchema,
	label: z.string().trim().min(1).max(80),
	position: z.number().int().min(0),
	/** Sólo en categorías: pide licencia de conducir profesional (chofer). */
	driver: z.boolean()
})
export type PeopleLookupEntry = z.infer<typeof peopleLookupEntrySchema>

/** GET /internal/lookups/:table — por `position`. */
export const peopleLookupResponseSchema = z.object({
	entries: z.array(peopleLookupEntrySchema)
})
