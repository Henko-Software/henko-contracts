import { z } from 'zod'

import { actorRefSchema } from '@henko-software/contracts-catalog'

export {
	type ActorRef,
	actorRefSchema,
	isoDateSchema,
	type RecordStatus,
	recordStatusSchema
} from '@henko-software/contracts-catalog'

/**
 * Piezas comunes del contrato de reporting. Las formas copian
 * `henko-web/apps/web/src/data/income_statement/schema.ts` y `rules.ts`:
 * mismos nombres, campos siempre presentes con `null`, enums en inglés.
 * Plata en centavos de pesos; meses `YYYY-MM`.
 */

/** Id de algo que guarda reporting (UUID). */
export const reportingIdSchema = z.uuid()

/** Mes del reporte: `2026-09`. */
export const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)

/** Entrada del historial («Actividad») de una ficha. */
export const historyEntrySchema = z.object({
	id: z.uuid(),
	at: z.iso.datetime(),
	/** Clave del catálogo de auditoría (`reporting.line.updated`). */
	action: z.string(),
	kind: z.enum(['created', 'updated', 'deleted', 'restored', 'note']),
	detail: z.string().nullable(),
	actor: actorRefSchema
})
export type HistoryEntry = z.infer<typeof historyEntrySchema>
