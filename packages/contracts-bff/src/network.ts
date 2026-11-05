import { z } from 'zod'

import {
	addressSchema,
	BAND_SOURCES,
	evaluationSchema,
	listSitesQuerySchema,
	listStoresQuerySchema,
	moveSiteRequestSchema,
	siteCreateSchema,
	siteFieldsSchema,
	siteSchema,
	siteStatusSchema,
	storeFieldsSchema,
	storeSchema
} from '@henko-software/contracts-network'

import { historyEventSchema } from './admin/common.js'

/**
 * Aperturas (`/openings`, flag `openings.evaluate`), Lugares
 * (`/openings/places`, flag `openings.places`) y la red de locales (flag
 * `openings`), armados con `network`. Las formas copian
 * `henko-web/apps/web/src/data/{openings,sites}/schema.ts`: el BFF pone el
 * nombre de quien hizo cada cosa (vacío si fue un superadmin y quien mira no
 * lo es) y, para la franja, lo que cada local le compró a la central
 * (sales).
 */

// ---------- Aperturas (flag `openings.evaluate`)

/** GET /api/openings/addresses?q= */
export const bffSearchAddressesQuerySchema = z.object({
	q: z.string().trim().max(120).optional()
})
export const bffAddressesResponseSchema = z.object({
	addresses: z.array(addressSchema)
})

/** GET /api/openings/evaluations/:addressId */
export const bffEvaluationResponseSchema = z.object({
	evaluation: evaluationSchema,
	/** De dónde salió la venta de la franja (`null`: sin franja). */
	bandSource: z.enum(BAND_SOURCES).nullable()
})

// ---------- Lugares (flag `openings.places`)

export const bffSiteSchema = siteSchema
	.omit({ createdBy: true, point: true, updatedAt: true })
	.extend({ createdBy: z.string() })
export type BffSite = z.infer<typeof bffSiteSchema>

export const bffSiteEventSchema = z.object({
	id: z.string(),
	at: z.iso.datetime(),
	user: z.string(),
	action: z.enum(['created', 'moved', 'updated', 'note']),
	from: siteStatusSchema.nullable(),
	to: siteStatusSchema.nullable(),
	detail: z.string().nullable()
})
export type BffSiteEvent = z.infer<typeof bffSiteEventSchema>

/** GET /api/sites?q=&status=&address= */
export const listBffSitesQuerySchema = listSitesQuerySchema
export const listBffSitesResponseSchema = z.object({
	sites: z.array(bffSiteSchema)
})
/** POST /api/sites */
export const bffCreateSiteBodySchema = siteCreateSchema
/** PUT /api/sites/:id */
export const bffUpdateSiteBodySchema = siteFieldsSchema
/** POST /api/sites/:id/move */
export const bffMoveSiteBodySchema = moveSiteRequestSchema
export const bffSiteResponseSchema = z.object({ site: bffSiteSchema })
/** GET /api/sites/:id/history */
export const bffSiteHistoryResponseSchema = z.object({
	history: z.array(bffSiteEventSchema)
})

// ---------- Red de locales (flag `openings`)

export const bffNetworkStoreSchema = storeSchema
	.omit({ createdBy: true })
	.extend({ createdBy: z.string() })
export type BffNetworkStore = z.infer<typeof bffNetworkStoreSchema>

/** GET /api/network/stores?q=&statuses= */
export const listBffNetworkStoresQuerySchema = listStoresQuerySchema
export const listBffNetworkStoresResponseSchema = z.object({
	stores: z.array(bffNetworkStoreSchema)
})
/** POST /api/network/stores · PUT /api/network/stores/:id */
export const bffNetworkStoreBodySchema = storeFieldsSchema
/** POST /api/network/stores/status */
export const bffNetworkStoresStatusBodySchema = z.object({
	ids: z.array(z.uuid()).min(1).max(500),
	status: z.enum(['active', 'deleted'])
})
export const bffNetworkStoreResponseSchema = z.object({
	store: bffNetworkStoreSchema
})
/** GET /api/network/stores/:id */
export const bffNetworkStoreDetailResponseSchema = z.object({
	store: bffNetworkStoreSchema,
	history: z.array(historyEventSchema)
})
