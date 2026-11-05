import { z } from 'zod'

import { listParam } from '@henko-software/contracts-common'

import {
	actorRefSchema,
	historyEntrySchema,
	isoDateSchema,
	networkIdSchema,
	recordStatusSchema,
	refIdSchema
} from './common.js'
import { pointSchema } from './openings.js'

/**
 * La red: los locales Big Pizza abiertos, con su punto en el mapa. Es lo
 * que le falta al lugar de entrega del cliente franquiciado (contacts no
 * guarda latitud y longitud): network guarda el punto, la fecha de apertura
 * y la gente alrededor, y el cliente queda referido por id. Con esto se
 * arman «los Big Pizza cerca» y la franja de lo que factura un local.
 */

export const storeFieldsSchema = z.object({
	/** El cliente franquiciado (contacts). Uno por local. */
	customerId: refIdSchema,
	/** «Big Pizza Belgrano». */
	name: z.string().trim().min(1).max(80),
	/** «Av. Cabildo 2040, Belgrano». */
	address: z.string().trim().min(1).max(200),
	point: pointSchema,
	/** El día que abrió (los primeros seis meses no cuentan para la franja). */
	openedOn: isoDateSchema,
	/**
	 * Venta al público por mes (centavos), cargada a mano o de Ayres IT. Si
	 * falta, se usa lo que le compra a la central (sales) o el adaptador.
	 */
	publicMonthly: z.number().int().min(0).nullable()
})
export type StoreFields = z.infer<typeof storeFieldsSchema>

export const storeSchema = storeFieldsSchema.extend({
	id: networkIdSchema,
	/** Gente a menos de 8 cuadras (del adaptador de población, al guardarlo). */
	population: z.number().int().min(0).nullable(),
	status: recordStatusSchema,
	createdAt: z.iso.datetime(),
	createdBy: actorRefSchema,
	updatedAt: z.iso.datetime()
})
export type Store = z.infer<typeof storeSchema>

/** GET /internal/stores?q=&statuses= — por nombre. */
export const listStoresQuerySchema = z.object({
	q: z.string().trim().max(120).optional(),
	statuses: listParam(recordStatusSchema)
})
export type ListStoresQuery = z.infer<typeof listStoresQuerySchema>

/** POST /internal/stores. Con `id` repetido no se duplica. */
export const createStoreRequestSchema = storeFieldsSchema.extend({
	id: networkIdSchema.optional()
})
export type CreateStoreRequest = z.input<typeof createStoreRequestSchema>

/** PUT /internal/stores/:id */
export const updateStoreRequestSchema = storeFieldsSchema

/** POST /internal/stores/status — baja y recuperación masivas. */
export const setStoresStatusRequestSchema = z.object({
	ids: z.array(networkIdSchema).min(1).max(500),
	status: recordStatusSchema
})

export const storeResponseSchema = z.object({ store: storeSchema })
export const listStoresResponseSchema = z.object({
	stores: z.array(storeSchema)
})
export const storeHistoryResponseSchema = z.object({
	history: z.array(historyEntrySchema)
})
