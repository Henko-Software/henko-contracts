import { z } from 'zod'

/**
 * Piezas comunes del contrato de sales. Las formas copian
 * `henko-web/apps/web/src/data/{orders,delivery_notes,invoices,sales}/schema.ts`:
 * mismos nombres, campos siempre presentes con `null`, enums en inglés.
 * Plata en centavos; fechas `YYYY-MM-DD`; instantes ISO en UTC.
 */

export { type VatRate, vatRateSchema } from '@henko-software/contracts-catalog'
export {
	airesCodeSchema,
	docTypeSchema,
	isoDateSchema,
	vatConditionSchema
} from '@henko-software/contracts-contacts'

/** Id de algo que guarda sales (UUIDv7). */
export const salesIdSchema = z.uuid()

/** Punto de venta y número: `0002-00097225`. */
export const documentNumberSchema = z.string().regex(/^\d{4}-\d{8}$/)

/** Id de un contacto (cliente, vendedor, transportista) de `contacts`. */
export const contactIdSchema = z.uuid()

/**
 * Quién hizo algo (autorizó un pedido, armó una hoja de ruta, una entrada
 * del historial). Si lo hizo un superadmin y quien mira no lo es, viene
 * `hidden: true` y sin id ni rol: el dato queda, lo que se esconde es quién.
 * El nombre lo pone el BFF.
 */
export const actorRefSchema = z.object({
	origin: z.enum(['person', 'automatic']),
	id: z.string().nullable(),
	role: z.string().nullable(),
	/** Del proceso automático (`orchestrator`). */
	label: z.string().nullable(),
	hidden: z.boolean()
})
export type ActorRef = z.infer<typeof actorRefSchema>

/** Entrada del historial («Actividad») de una ficha. */
export const historyEntrySchema = z.object({
	id: z.uuid(),
	at: z.iso.datetime(),
	/** Clave del catálogo de auditoría (`sales.order.created`). */
	action: z.string(),
	actionLabel: z.string(),
	kind: z.enum(['created', 'updated', 'deleted', 'restored', 'note']),
	/** Qué cambió, ya legible. */
	detail: z.string().nullable(),
	actor: actorRefSchema
})
export type HistoryEntry = z.infer<typeof historyEntrySchema>

/** `POST /internal/…/close|cancel|restore` — todo o nada. 204. */
export const idsRequestSchema = z.object({
	ids: z.array(salesIdSchema).min(1).max(500)
})
export type IdsRequest = z.infer<typeof idsRequestSchema>

/** Rango de fechas inclusivo. */
export const dateRangeQuerySchema = z.object({
	from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
})
