import { z } from 'zod'

/**
 * Piezas comunes del contrato de network. Las formas copian
 * `henko-web/apps/web/src/data/{openings,sites}/schema.ts`: mismos nombres,
 * campos siempre presentes con `null`, enums en inglés. Plata en centavos,
 * distancias en metros, fechas `YYYY-MM-DD` e instantes ISO en UTC.
 */

/** Id de algo que guarda network (UUIDv7). */
export const networkIdSchema = z.uuid()

/** Un id de otro módulo (un cliente de contacts): texto corto. */
export const refIdSchema = z.string().trim().min(1).max(80)

/** Día sin hora, `YYYY-MM-DD`. */
export const isoDateSchema = z.iso.date()

/** Plata en centavos, entera. */
export const centsSchema = z.number().int()

/**
 * Quién hizo algo. Si lo hizo un superadmin y quien mira no lo es, viene
 * `hidden: true` y sin id ni rol: el dato queda, lo que se esconde es quién.
 * El nombre lo pone el BFF.
 */
export const actorRefSchema = z.object({
	origin: z.enum(['person', 'automatic']),
	id: z.string().nullable(),
	role: z.string().nullable(),
	label: z.string().nullable(),
	hidden: z.boolean()
})
export type ActorRef = z.infer<typeof actorRefSchema>

/** Entrada del historial («Actividad») de una ficha, de la auditoría. */
export const historyEntrySchema = z.object({
	id: z.uuid(),
	at: z.iso.datetime(),
	action: z.string(),
	actionLabel: z.string(),
	kind: z.enum(['created', 'updated', 'deleted', 'restored', 'note']),
	detail: z.string().nullable(),
	actor: actorRefSchema
})
export type HistoryEntry = z.infer<typeof historyEntrySchema>

/** Baja lógica, como el resto de Henko. */
export const RECORD_STATUSES = ['active', 'deleted'] as const
export const recordStatusSchema = z.enum(RECORD_STATUSES)
export type RecordStatus = z.infer<typeof recordStatusSchema>
