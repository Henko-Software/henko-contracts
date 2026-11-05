import { z } from 'zod'

export { booleanParam, listParam } from '@henko-software/contracts-common'
export { isoDateSchema } from '@henko-software/contracts-contacts'

/**
 * Piezas comunes del contrato de stock. Las formas copian
 * `henko-web/apps/web/src/data/{stock,counts}/schema.ts`: mismos nombres,
 * campos siempre presentes con `null`, enums en inglés. Cantidades en la
 * unidad de stock del artículo (kilos con tres decimales, unidades);
 * fechas `YYYY-MM-DD`; instantes ISO en UTC.
 */

/** Id de algo que guarda stock (UUIDv7): movimientos, operaciones, conteos. */
export const stockIdSchema = z.uuid()

/** Id de un artículo de `catalog`. */
export const articleIdSchema = z.string().min(1).max(60)

/**
 * Id de una ubicación. Las sembradas tienen ids legibles (`ub-n-cong`, los
 * del front); las nuevas, un UUID.
 */
export const locationIdSchema = z
	.string()
	.trim()
	.min(1)
	.max(40)
	.regex(/^[a-z0-9-]+$/)

/** El lote: el del proveedor o, en lo producido, la fecha de elaboración. */
export const lotSchema = z.string().trim().min(1).max(40)

/** Una cantidad con signo, con tres decimales como mucho. */
export const quantitySchema = z
	.number()
	.finite()
	.refine(value => Math.abs(value) < 1e12, { message: 'Fuera de rango' })

export const positiveQuantitySchema = quantitySchema.refine(
	value => value > 0,
	{ message: 'Tiene que ser más que cero.' }
)

/**
 * Quién hizo algo. Si lo hizo un superadmin y quien mira no lo es, viene
 * `hidden: true` y sin id ni rol: el dato queda, lo que se esconde es quién.
 * El nombre lo pone el BFF.
 */
export const actorRefSchema = z.object({
	origin: z.enum(['person', 'automatic']),
	id: z.string().nullable(),
	role: z.string().nullable(),
	/** Del proceso automático (`stock`, por los eventos de otros módulos). */
	label: z.string().nullable(),
	hidden: z.boolean()
})
export type ActorRef = z.infer<typeof actorRefSchema>

/** Entrada del historial («Actividad») de una ficha. */
export const historyEntrySchema = z.object({
	id: z.uuid(),
	at: z.iso.datetime(),
	/** Clave del catálogo de auditoría (`stock.count.closed`). */
	action: z.string(),
	actionLabel: z.string(),
	kind: z.enum(['created', 'updated', 'deleted', 'restored', 'note']),
	detail: z.string().nullable(),
	actor: actorRefSchema
})
export type HistoryEntry = z.infer<typeof historyEntrySchema>

/** Contra-movimiento: anular algo que ya movió stock. */
export const voidRequestSchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	reason: z.string().trim().min(1).max(120)
})
export type VoidRequest = z.infer<typeof voidRequestSchema>
