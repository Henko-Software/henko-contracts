import { z } from 'zod'

import { actorRefSchema, catalogIdSchema, isoDateSchema } from './common.js'

/**
 * Historial del costo de un insumo: lo que fue cambiando `cost.purchasePrice`
 * con las facturas de compra aceptadas (`purchases.invoice.accepted.v1`) y
 * sus anulaciones. Manda el **último precio facturado** (por fecha de la
 * factura), **neto** (sin IVA) y **por la unidad de compra**, igual que
 * `cost.purchasePrice`; el costo por unidad de stock sigue siendo
 * `purchasePrice / purchaseQuantity`.
 */

/**
 * `invoice`: una factura aceptada trajo un precio. `invoice_voided`: se
 * anuló la factura que había puesto el costo y vuelve el de antes.
 */
export const COST_CHANGE_KINDS = ['invoice', 'invoice_voided'] as const
export const costChangeKindSchema = z.enum(COST_CHANGE_KINDS)
export type CostChangeKind = z.infer<typeof costChangeKindSchema>

export const articleCostChangeSchema = z.object({
	id: z.uuid(),
	articleId: catalogIdSchema,
	kind: costChangeKindSchema,
	/** El costo por unidad de compra antes del cambio (centavos sin IVA). */
	previousPrice: z.number().int().min(0).nullable(),
	/** El de la factura (o el que volvió, si se anuló). */
	price: z.number().int().min(0),
	/**
	 * ¿Cambió el costo del artículo? `false` si ya había un costo de una
	 * factura con fecha más nueva, o si se anuló una factura que ya no
	 * mandaba.
	 */
	applied: z.boolean(),
	/** Cuánto facturó (unidades de compra). */
	quantity: z.number().min(0),
	invoice: z.object({
		id: z.uuid(),
		supplierId: z.uuid(),
		/** Letra y número del proveedor (`A 00004-00012845`); `null` si el evento no los trajo. */
		label: z.string().nullable(),
		date: isoDateSchema
	}),
	/** Quién aceptó (o anuló) la factura, con el rastro del superadmin oculto. */
	actor: actorRefSchema,
	at: z.iso.datetime()
})
export type ArticleCostChange = z.infer<typeof articleCostChangeSchema>

/** GET /internal/articles/:id/cost-history — del más nuevo al más viejo. */
export const articleCostHistoryResponseSchema = z.object({
	changes: z.array(articleCostChangeSchema)
})
