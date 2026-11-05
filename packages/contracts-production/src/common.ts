import { z } from 'zod'

import {
	articleSchema,
	isoDateSchema,
	PRODUCTION_TYPES,
	STOCK_UNITS
} from '@henko-software/contracts-catalog'

export { isoDateSchema, PRODUCTION_TYPES, STOCK_UNITS }

/**
 * Piezas comunes del contrato de production. Las formas copian
 * `henko-web/apps/web/src/data/{production,traceability}/schema.ts` y
 * `rules.ts`: mismos nombres, campos siempre presentes con `null`, enums en
 * inglés. Cantidades en la unidad de stock del artículo; fechas
 * `YYYY-MM-DD`; instantes ISO en UTC.
 */

/** Id de algo que guarda production (UUIDv7). */
export const productionIdSchema = z.uuid()

/** Id de un artículo de `catalog`. */
export const articleIdSchema = z.uuid()

/** Un id de otro módulo (ubicación, movimiento, remito): texto corto. */
export const refIdSchema = z.string().trim().min(1).max(80)

/** Un lote: la fecha de elaboración («05-11-26») o el del proveedor. */
export const lotSchema = z.string().trim().min(1).max(40)

/** Una cantidad en la unidad de stock (kilos con tres decimales, unidades). */
export const quantitySchema = z.number().finite()

/**
 * Lo que production necesita de un artículo (`catalog`): qué es, la unidad
 * y el mínimo de stock, la receta (con la merma) y los datos de producción
 * (tipo, tanda, vida útil). Las recetas viven en catalog. El BFF puede
 * mandar el artículo entero: lo demás se descarta.
 */
export const productionArticleSchema = articleSchema.pick({
	id: true,
	code: true,
	description: true,
	kind: true,
	status: true,
	stock: true,
	recipe: true,
	production: true
})
export type ProductionArticle = z.infer<typeof productionArticleSchema>

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

/** Entrada del historial («Actividad») de una ficha. */
export const historyEntrySchema = z.object({
	id: z.uuid(),
	at: z.iso.datetime(),
	/** Clave del catálogo de auditoría (`production.order.closed`). */
	action: z.string(),
	actionLabel: z.string(),
	kind: z.enum(['created', 'updated', 'deleted', 'restored', 'note']),
	detail: z.string().nullable(),
	actor: actorRefSchema
})
export type HistoryEntry = z.infer<typeof historyEntrySchema>
