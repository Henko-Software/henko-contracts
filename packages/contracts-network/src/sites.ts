import { z } from 'zod'

import { listParam } from '@henko-software/contracts-common'

import { actorRefSchema, isoDateSchema, networkIdSchema } from './common.js'
import { addressSchema, pointSchema, VERDICTS } from './openings.js'

/**
 * Lugares: las esquinas que el equipo va anotando para abrir. Un embudo,
 * «Para mirar» → «Ya fuimos» → «Negociando» → «Nos lo quedamos», o «No
 * sirve» con el porqué. Copia `henko-web/apps/web/src/data/sites/schema.ts`.
 * No se borran: se descartan (con el motivo) y se pueden volver a abrir.
 */

export const SITE_STATUSES = [
	'watching',
	'visited',
	'negotiating',
	'approved',
	'discarded'
] as const
export const siteStatusSchema = z.enum(SITE_STATUSES)
export type SiteStatus = z.infer<typeof siteStatusSchema>

export const ENERGY_KINDS = ['gas', 'electric'] as const

/** Lo que se carga a mano de un lugar: todo opcional, se completa de a poco. */
export const siteFieldsSchema = z.object({
	nickname: z.string().trim().max(60).nullable(),
	forWhom: z.string().trim().max(80).nullable(),
	contact: z.string().trim().max(120).nullable(),
	areaM2: z.number().int().positive().max(5_000).nullable(),
	frontM: z.number().positive().max(100).nullable(),
	corner: z.boolean().nullable(),
	energy: z.enum(ENERGY_KINDS).nullable(),
	/** Lo que piden por mes, en centavos. */
	rent: z.number().int().positive().nullable(),
	source: z.string().trim().max(200).nullable(),
	notes: z.string().max(2_000)
})
export type SiteFields = z.infer<typeof siteFieldsSchema>

/** Guardar una esquina desde su ficha: nace en «Para mirar». */
export const siteCreateSchema = siteFieldsSchema.partial().extend({
	addressId: addressSchema.shape.id,
	street: z.string().trim().min(1).max(200),
	area: z.string().trim().max(120),
	city: z.string().trim().max(120),
	/** El puntaje y el veredicto del día que se guardó. */
	score: z.number().int().min(0).max(100).nullable(),
	verdict: z.enum(VERDICTS).nullable()
})
export type SiteCreate = z.infer<typeof siteCreateSchema>

export const siteSchema = siteFieldsSchema.extend({
	id: networkIdSchema,
	addressId: z.string(),
	street: z.string(),
	area: z.string(),
	city: z.string(),
	/** El punto de la dirección, si network la conoce (para el alquiler de la zona). */
	point: pointSchema.nullable(),
	status: siteStatusSchema,
	statusSince: isoDateSchema,
	discardReason: z.string().max(200).nullable(),
	score: z.number().int().min(0).max(100).nullable(),
	verdict: z.enum(VERDICTS).nullable(),
	createdAt: isoDateSchema,
	createdBy: actorRefSchema,
	updatedAt: z.iso.datetime()
})
export type Site = z.infer<typeof siteSchema>

export const SITE_EVENT_ACTIONS = [
	'created',
	'moved',
	'updated',
	'note'
] as const

/** Una línea del historial de un lugar (lo propio del embudo). */
export const siteEventSchema = z.object({
	id: networkIdSchema,
	at: z.iso.datetime(),
	actor: actorRefSchema,
	action: z.enum(SITE_EVENT_ACTIONS),
	from: siteStatusSchema.nullable(),
	to: siteStatusSchema.nullable(),
	detail: z.string().nullable()
})
export type SiteEvent = z.infer<typeof siteEventSchema>

/** GET /internal/sites?q=&status=&address= — del cambio más nuevo al viejo. */
export const listSitesQuerySchema = z.object({
	q: z.string().trim().max(120).optional(),
	status: listParam(siteStatusSchema),
	address: z.string().trim().min(1).max(120).optional()
})
export type ListSitesQuery = z.infer<typeof listSitesQuerySchema>

/** POST /internal/sites. Con `id` repetido no se duplica. */
export const createSiteRequestSchema = siteCreateSchema.extend({
	id: networkIdSchema.optional()
})
export type CreateSiteRequest = z.input<typeof createSiteRequestSchema>

/** PUT /internal/sites/:id */
export const updateSiteRequestSchema = siteFieldsSchema

/**
 * POST /internal/sites/:id/move. A «No sirve» la nota es el motivo y es
 * obligatoria. Al mismo estado con nota: queda como nota en el historial.
 */
export const moveSiteRequestSchema = z
	.object({
		status: siteStatusSchema,
		note: z.string().trim().max(200).optional()
	})
	.refine(input => input.status !== 'discarded' || Boolean(input.note), {
		path: ['note'],
		message: 'Contá por qué no sirve.'
	})
export type MoveSiteRequest = z.input<typeof moveSiteRequestSchema>

export const siteResponseSchema = z.object({ site: siteSchema })
export const listSitesResponseSchema = z.object({ sites: z.array(siteSchema) })
export const siteHistoryResponseSchema = z.object({
	history: z.array(siteEventSchema)
})
