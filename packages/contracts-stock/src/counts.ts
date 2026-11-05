import { z } from 'zod'

import {
	actorRefSchema,
	articleIdSchema,
	listParam,
	locationIdSchema,
	stockIdSchema
} from './common.js'

/**
 * Conteos (Aires: Inventarios). Se cuenta una ubicación por vez, a ciegas;
 * al terminar, cada diferencia queda como ajuste con motivo `count`. Forma
 * de `henko-web/apps/web/src/data/counts/schema.ts`.
 */

export const COUNT_STATES = ['open', 'closed', 'cancelled'] as const
export const countStateSchema = z.enum(COUNT_STATES)
export type CountState = z.infer<typeof countStateSchema>

/** En la unidad de stock; tres decimales como mucho. */
const countedSchema = z.number().finite().min(0).max(1e9)

export const countLineSchema = z.object({
	articleId: articleIdSchema,
	/** `null`: sin contar (no se ajusta). */
	counted: countedSchema.nullable(),
	/** Lo que decía Henko al terminar; `null` mientras se cuenta. */
	expected: z.number().nullable()
})
export type CountLine = z.infer<typeof countLineSchema>

export const stockCountSchema = z.object({
	id: stockIdSchema,
	/** «0013». */
	number: z.string().regex(/^\d{4,}$/),
	locationId: locationIdSchema,
	state: countStateSchema,
	startedAt: z.iso.datetime(),
	startedBy: actorRefSchema,
	closedAt: z.iso.datetime().nullable(),
	closedBy: actorRefSchema.nullable(),
	/** La operación de los ajustes (al terminar con diferencias). */
	operationId: stockIdSchema.nullable(),
	lines: z.array(countLineSchema),
	version: z.number().int().min(1)
})
export type StockCount = z.infer<typeof stockCountSchema>

/** `GET /internal/counts?states=&locationIds=` — primero los en curso. */
export const listCountsQuerySchema = z.object({
	states: listParam(countStateSchema),
	locationIds: listParam(locationIdSchema)
})
export type ListCountsQuery = z.output<typeof listCountsQuerySchema>
export const listCountsResponseSchema = z.object({
	counts: z.array(stockCountSchema)
})
export const countResponseSchema = z.object({ count: stockCountSchema })

/**
 * `POST /internal/counts` — empieza a contar una ubicación con sus artículos
 * (los que tienen algo ahí y los que se guardan ahí). Si ya hay uno en curso
 * ahí, devuelve ese con `created: false`.
 */
export const startCountRequestSchema = z.object({
	id: stockIdSchema.optional(),
	locationId: locationIdSchema
})
export const startCountResponseSchema = z.object({
	count: stockCountSchema,
	created: z.boolean()
})

/** `PUT /internal/counts/:id/lines/:articleId` — `stock.count_not_open` si no está en curso. */
export const recordCountLineRequestSchema = z.object({
	counted: countedSchema.nullable()
})

export const reviewLineSchema = z.object({
	articleId: articleIdSchema,
	counted: z.number().nullable(),
	expected: z.number(),
	/** Contado − esperado; `null` si no se contó. */
	diff: z.number().nullable()
})
export type ReviewLine = z.infer<typeof reviewLineSchema>
/** `GET /internal/counts/:id/review` — lo contado contra lo que dice Henko ahora. */
export const reviewCountResponseSchema = z.object({
	lines: z.array(reviewLineSchema)
})
