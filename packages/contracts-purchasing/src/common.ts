import { z } from 'zod'

/**
 * Piezas comunes del contrato de purchasing. Las formas copian
 * `henko-web/apps/web/src/data/{purchase_orders,receptions,purchase_invoices}/schema.ts`:
 * mismos nombres, campos siempre presentes con `null`, enums en inglés.
 * Plata en centavos; fechas `YYYY-MM-DD`; instantes ISO en UTC.
 */

export { type VatRate, vatRateSchema } from '@henko-software/contracts-catalog'
export { booleanParam, listParam } from '@henko-software/contracts-common'
export {
	isoDateSchema,
	PROVINCES,
	provinceSchema
} from '@henko-software/contracts-contacts'

/** Id de algo que guarda purchasing (UUIDv7). */
export const purchasingIdSchema = z.uuid()

/** Id de un proveedor (contacto de `contacts`). */
export const supplierIdSchema = z.uuid()

/** Id de un artículo de `catalog`. */
export const articleIdSchema = z.string().min(1).max(60)

/** Número correlativo de seis dígitos (O.Compra de Aires: 004912). */
export const sixDigitsSchema = z.string().regex(/^\d{6}$/)

/** Punto de venta y número de un comprobante del proveedor: 00004-00012845. */
export const invoiceNumberSchema = z
	.string()
	.regex(/^\d{4,5}-\d{8}$/, 'Punto de venta y número: 00004-00012845.')

/**
 * Quién hizo algo (cargó un pedido, recibió, aceptó una factura, una
 * entrada del historial). Si lo hizo un superadmin y quien mira no lo es,
 * viene `hidden: true` y sin id ni rol: el dato queda, lo que se esconde es
 * quién. El nombre lo pone el BFF.
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
	/** Clave del catálogo de auditoría (`purchases.order.created`). */
	action: z.string(),
	actionLabel: z.string(),
	kind: z.enum(['created', 'updated', 'deleted', 'restored', 'note']),
	/** Qué cambió, ya legible. */
	detail: z.string().nullable(),
	actor: actorRefSchema
})
export type HistoryEntry = z.infer<typeof historyEntrySchema>

/** Una fecha para marcar algo (mandado, anulado, se pagó entera). */
export const dateRequestSchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
})

/** Anular: la fecha y, si se quiere, por qué. */
export const voidRequestSchema = dateRequestSchema.extend({
	reason: z.string().trim().min(1).max(120).nullable().default(null)
})
export type VoidRequest = z.input<typeof voidRequestSchema>
