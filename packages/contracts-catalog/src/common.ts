import { z } from 'zod'

import { recordStatusSchema } from '@henko-software/contracts-contacts'

/**
 * Piezas comunes del contrato de catalog. Las formas copian
 * `henko-web/apps/web/src/data/<entidad>/schema.ts`: mismos nombres, campos
 * siempre presentes con `null`, enums en inglés.
 */

export {
	airesCodeSchema,
	isoDateSchema,
	lookupCodeSchema,
	type RecordStatus,
	recordStatusSchema
} from '@henko-software/contracts-contacts'

/** Id de algo que guarda catalog (UUIDv7). */
export const catalogIdSchema = z.uuid()

/**
 * Id de una pieza adentro de un artículo (presentación, rótulo): lo genera
 * el front al agregarla.
 */
export const partIdSchema = z.string().trim().min(1).max(60)

/**
 * Quién hizo algo (el autor de un precio, una entrada del historial). Si lo
 * hizo un superadmin y quien mira no lo es, viene `hidden: true` y sin id ni
 * rol: el dato queda, lo que se esconde es quién. El nombre lo pone el BFF.
 */
export const actorRefSchema = z.object({
	origin: z.enum(['person', 'automatic']),
	id: z.string().nullable(),
	role: z.string().nullable(),
	/** Del proceso automático (`aires-import`). */
	label: z.string().nullable(),
	hidden: z.boolean()
})
export type ActorRef = z.infer<typeof actorRefSchema>

/** POST /internal/<entidad>/status — baja o recuperación, todo o nada. 204. */
export const setStatusRequestSchema = z.object({
	ids: z.array(catalogIdSchema).min(1).max(500),
	status: recordStatusSchema
})
export type SetStatusRequest = z.infer<typeof setStatusRequestSchema>

/**
 * Entrada del historial («Actividad») de una ficha. `kind` y `detail` los
 * arma catalog con lo que cambió («Descripción: A → B · Receta»).
 */
export const historyEntrySchema = z.object({
	id: z.uuid(),
	at: z.iso.datetime(),
	/** Clave del catálogo de auditoría (`catalog.article.updated`). */
	action: z.string(),
	actionLabel: z.string(),
	kind: z.enum(['created', 'updated', 'deleted', 'restored']),
	detail: z.string().nullable(),
	actor: actorRefSchema
})
export type HistoryEntry = z.infer<typeof historyEntrySchema>

export const historyResponseSchema = z.object({
	entries: z.array(historyEntrySchema)
})
