import { z } from 'zod'

import {
	actorRefSchema,
	articleIdSchema,
	historyEntrySchema,
	isoDateSchema,
	listParam,
	purchasingIdSchema,
	sixDigitsSchema,
	supplierIdSchema
} from './common.js'

/**
 * Pedidos a proveedores (Aires: Compras › Órdenes de compra). Copia
 * `henko-web/apps/web/src/data/purchase_orders/schema.ts`. Lo recibido lo
 * suma la recepción y el cierre lo pone la factura: el pedido no se cierra
 * a mano.
 */

/**
 * Dónde está el pedido, calculado (`purchaseOrderStatus` del front):
 * `ordered`, `late` (pasó la fecha y no llegó nada), `partial`, `received`
 * (llegó todo o lo que falta no va a llegar), `invoiced`, `cancelled`.
 */
export const PURCHASE_ORDER_STATUSES = [
	'ordered',
	'late',
	'partial',
	'received',
	'invoiced',
	'cancelled'
] as const
export const purchaseOrderStatusSchema = z.enum(PURCHASE_ORDER_STATUSES)
export type PurchaseOrderStatus = z.infer<typeof purchaseOrderStatusSchema>

/** Un renglón: un insumo en su unidad de compra («Bolsa de 25 kg»). */
export const purchaseOrderLineSchema = z.object({
	articleId: articleIdSchema,
	/** Cuántas unidades de compra se piden. */
	quantity: z.number().positive(),
	/** Lo que se paga por la unidad de compra, en centavos sin IVA. */
	unitPrice: z.number().int().min(0),
	/** Cuántas llegaron (lo suma la recepción). */
	received: z.number().min(0)
})
export type PurchaseOrderLine = z.infer<typeof purchaseOrderLineSchema>

export const purchaseOrderLineInputSchema = purchaseOrderLineSchema.omit({
	received: true
})

/** Lo que se carga (`PurchaseOrderInput` del front). */
export const purchaseOrderInputSchema = z.object({
	supplierId: supplierIdSchema,
	deliveryDate: isoDateSchema,
	notes: z.string().trim().max(500).nullable(),
	lines: z.array(purchaseOrderLineInputSchema).min(1).max(300)
})
export type PurchaseOrderInput = z.infer<typeof purchaseOrderInputSchema>

export const purchaseOrderSchema = z.object({
	id: purchasingIdSchema,
	/** «O.Compra» de Aires: 004912. */
	number: sixDigitsSchema,
	/** Para qué local se compra (alcance); `null` = casa central. */
	localId: z.string().nullable(),
	supplierId: supplierIdSchema,
	/** Cuándo se cargó. */
	date: isoDateSchema,
	deliveryDate: isoDateSchema,
	notes: z.string().max(500).nullable(),
	lines: z.array(purchaseOrderLineSchema).min(1),
	sentAt: isoDateSchema.nullable(),
	/** Lo que falta no va a llegar (lo pone la recepción con `closesOrder`). */
	closedShortAt: isoDateSchema.nullable(),
	/** Lo pone la factura que lo cierra. */
	invoicedAt: isoDateSchema.nullable(),
	cancelledAt: isoDateSchema.nullable(),
	cancelReason: z.string().max(120).nullable(),
	createdBy: actorRefSchema,
	/** Calculado al leer, con la fecha de hoy en Argentina. */
	status: purchaseOrderStatusSchema,
	version: z.number().int().min(1),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime()
})
export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>

/**
 * GET /internal/purchase-orders — del más nuevo al más viejo. `query` sobre
 * el número y lo que mande quien llama en `querySupplierIds` (los
 * proveedores cuyo nombre coincide) y `queryArticleIds` (los insumos).
 */
export const listPurchaseOrdersQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	querySupplierIds: listParam(z.uuid()),
	queryArticleIds: listParam(articleIdSchema),
	statuses: listParam(purchaseOrderStatusSchema),
	supplierIds: listParam(z.uuid()),
	limit: z.coerce.number().int().min(1).max(2000).default(500)
})
export type ListPurchaseOrdersQuery = z.output<
	typeof listPurchaseOrdersQuerySchema
>

export const listPurchaseOrdersResponseSchema = z.object({
	orders: z.array(purchaseOrderSchema)
})

/** GET /internal/purchase-orders/:id */
export const purchaseOrderDetailResponseSchema = z.object({
	order: purchaseOrderSchema,
	history: z.array(historyEntrySchema)
})

/** POST · PUT · POST /sent · /cancel */
export const purchaseOrderResponseSchema = z.object({
	order: purchaseOrderSchema
})

/** GET /internal/purchase-orders/next-number */
export const nextNumberResponseSchema = z.object({ number: sixDigitsSchema })

/**
 * POST /internal/purchase-orders — alta. Con `id` repetido no se duplica
 * (200 con el que hay). `localId`: para qué local; `null` = casa central.
 */
export const createPurchaseOrderRequestSchema = z.object({
	id: purchasingIdSchema.optional(),
	localId: z.string().min(1).max(40).nullable().default(null),
	order: purchaseOrderInputSchema
})
export type CreatePurchaseOrderRequest = z.input<
	typeof createPurchaseOrderRequestSchema
>

/**
 * PUT /internal/purchase-orders/:id — objeto entero. Sólo mientras no llegó
 * nada y no está anulado (`purchasing.order_locked`).
 */
export const updatePurchaseOrderRequestSchema = z.object({
	order: purchaseOrderInputSchema,
	expectedVersion: z.number().int().min(1).optional()
})
export type UpdatePurchaseOrderRequest = z.input<
	typeof updatePurchaseOrderRequestSchema
>
