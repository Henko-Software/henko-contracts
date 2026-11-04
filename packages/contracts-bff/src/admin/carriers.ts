import { z } from 'zod'

import {
	airesCodeSchema,
	carrierProfileInputSchema,
	docTypeSchema,
	provinceSchema,
	recordStatusSchema,
	vehicleKindSchema,
	vehicleSchema
} from '@henko-software/contracts-contacts'

import {
	baseContactInfoSchema,
	booleanParam,
	historyEventSchema,
	listParam,
	recordIdSchema,
	statusesParam
} from './common.js'

/**
 * Transportistas (`/admin/carriers`): contactos con rol `carrier`, con los
 * datos de contacto planos en la raíz como
 * `henko-web/apps/web/src/data/carriers/schema.ts`. `kind` es `driver` para
 * un contacto `person`.
 */

export const CARRIER_KINDS = ['driver', 'company'] as const
export const carrierKindSchema = z.enum(CARRIER_KINDS)

const profile = carrierProfileInputSchema.shape

const carrierFields = {
	name: z.string().trim().min(1).max(160),
	kind: carrierKindSchema,
	docType: docTypeSchema,
	docNumber: z.string().max(20).nullable(),
	vehicles: profile.vehicles,
	coverage: profile.coverage,
	notes: profile.notes,
	airesLegalName: profile.airesLegalName,
	...baseContactInfoSchema.shape
}

export const carrierSchema = z.object({
	id: recordIdSchema,
	code: airesCodeSchema,
	...carrierFields,
	status: recordStatusSchema
})
export type Carrier = z.infer<typeof carrierSchema>

/** POST /api/carriers · PUT /api/carriers/:id */
export const carrierInputSchema = z.object(carrierFields)
export type CarrierInput = z.infer<typeof carrierInputSchema>

/** `yes`: algún vehículo con frío (A o B); `no`: ninguno; `blocked`: alguno con frío que hoy no puede llevar congelados. */
export const COLD_FILTERS = ['yes', 'no', 'blocked'] as const

/**
 * GET /api/carriers — todos los que cumplen, por nombre, más «Sin asignar»
 * (`ca-000001`, de sistema) si entra en los filtros. `cold` y `documentsDue`
 * los calcula el BFF con las reglas del front, con el día de Argentina.
 */
export const listCarriersQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	statuses: statusesParam,
	kinds: listParam(carrierKindSchema),
	vehicleKinds: listParam(vehicleKindSchema),
	cold: listParam(z.enum(COLD_FILTERS)),
	provinces: listParam(provinceSchema),
	documentsDue: booleanParam.optional()
})
export type ListCarriersQuery = z.output<typeof listCarriersQuerySchema>

export const listCarriersResponseSchema = z.object({
	carriers: z.array(carrierSchema)
})

/** GET /api/carriers/:id · POST · PUT */
export const carrierResponseSchema = z.object({ carrier: carrierSchema })

/** GET /api/carriers/by-plate/:plate — quién más tiene esa patente. */
export const plateMatchesResponseSchema = z.object({
	matches: z.array(z.object({ carrier: carrierSchema, vehicle: vehicleSchema }))
})

/** GET /api/carriers/:id/history */
export const carrierHistoryResponseSchema = z.object({
	history: z.array(historyEventSchema)
})
