import { z } from 'zod'

import { catalogLookupTableSchema } from '@henko-software/contracts-catalog'
import {
	contactKindSchema,
	createLookupEntryRequestSchema,
	cuitSchema,
	DEFAULT_CONTACT_KIND,
	lookupEntrySchema,
	lookupTableSchema,
	recordStatusSchema,
	updateLookupEntryRequestSchema
} from '@henko-software/contracts-contacts'

import { listParam } from './common.js'

/**
 * Contactos (`/contacts`, la pantalla modelo) y tablas auxiliares.
 *
 * La pantalla de contactos muestra sólo estos roles: los demás
 * (transportista, vendedor) tienen su pantalla. Clientes y proveedores
 * piden datos que esta pantalla no carga: se suman desde su pantalla
 * (`common.validation` en `roles` si vienen acá).
 */
export const SCREEN_CONTACT_ROLES = [
	'customer',
	'supplier',
	'franchise',
	'employee'
] as const
export const screenContactRoleSchema = z.enum(SCREEN_CONTACT_ROLES)

export const screenContactSchema = z.object({
	id: z.uuid(),
	kind: contactKindSchema,
	name: z.string().trim().min(1).max(160),
	/** El documento, si es un CUIT. */
	taxId: cuitSchema.nullable(),
	email: z.email().nullable(),
	phone: z.string().max(40).nullable(),
	roles: z.array(screenContactRoleSchema).min(1),
	createdAt: z.iso.datetime()
})
export type ScreenContact = z.infer<typeof screenContactSchema>

/** POST /api/contacts — sin `kind`, empresa (decisión asumida 19). */
export const screenContactInputSchema = screenContactSchema
	.pick({
		kind: true,
		name: true,
		taxId: true,
		email: true,
		phone: true,
		roles: true
	})
	.extend({ kind: contactKindSchema.default(DEFAULT_CONTACT_KIND) })
export type ScreenContactInput = z.infer<typeof screenContactInputSchema>

/** GET /api/contacts?query=&role= — por nombre. */
export const listScreenContactsQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	role: screenContactRoleSchema.optional()
})

export const listScreenContactsResponseSchema = z.object({
	contacts: z.array(screenContactSchema)
})
export const screenContactResponseSchema = z.object({
	contact: screenContactSchema
})

// ---------- Tablas auxiliares

/**
 * GET /api/lookups/:table?statuses=active (por defecto, las activas) —
 * Tipo de Cliente, Canal de Venta y rubros de proveedores (contacts),
 * categorías y envases de artículos (catalog), por `position`.
 * POST /api/lookups/:table · PUT /api/lookups/:table/:code ·
 * POST /api/lookups/:table/status (204): el ABM, igual en los dos módulos.
 */
export const bffLookupTableSchema = z.enum([
	...lookupTableSchema.options,
	...catalogLookupTableSchema.options
])
export type BffLookupTable = z.infer<typeof bffLookupTableSchema>
export const listLookupBffQuerySchema = z.object({
	statuses: listParam(recordStatusSchema)
})
export const lookupEntriesResponseSchema = z.object({
	entries: z.array(lookupEntrySchema)
})
export const lookupEntryBffResponseSchema = z.object({
	entry: lookupEntrySchema
})
export const createLookupEntryBodySchema = createLookupEntryRequestSchema
export const updateLookupEntryBodySchema = updateLookupEntryRequestSchema
export const setLookupStatusBodySchema = z.object({
	codes: z.array(z.string().trim().min(1).max(40)).min(1).max(500),
	status: recordStatusSchema
})
