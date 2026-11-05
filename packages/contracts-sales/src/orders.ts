import { z } from 'zod'

import { listParam } from '@henko-software/contracts-common'

import {
	actorRefSchema,
	airesCodeSchema,
	contactIdSchema,
	documentNumberSchema,
	historyEntrySchema,
	isoDateSchema,
	salesIdSchema,
	vatRateSchema
} from './common.js'

/**
 * Pedidos (Aires: Ventas › Pedidos). Copia
 * `henko-web/apps/web/src/data/orders/schema.ts`. El precio de cada línea
 * lo resuelve quien llama con catalog (`/internal/prices/resolve`) y sales
 * lo congela: al editar, lo que ya estaba conserva su precio.
 */

export const ORDER_KINDS = ['sale'] as const
/** Lo que se guarda; lo demás se calcula (`stage`). */
export const ORDER_STATUSES = ['open', 'closed', 'cancelled'] as const
export const orderStatusSchema = z.enum(ORDER_STATUSES)
export type OrderStatus = z.infer<typeof orderStatusSchema>

/** En qué anda un pedido (`orderStage` del front). */
export const ORDER_STAGES = [
	'held',
	'authorized',
	'partial',
	'delivered',
	'invoiced',
	'closed',
	'cancelled'
] as const
export const orderStageSchema = z.enum(ORDER_STAGES)
export type OrderStage = z.infer<typeof orderStageSchema>

/** Un paso de la autorización (comercial o financiera). */
export const authorizationStepSchema = z.object({
	at: z.iso.datetime(),
	/** Quién autorizó; el sistema solo si `auto`. */
	actor: actorRefSchema,
	auto: z.boolean(),
	note: z.string().max(200).nullable()
})
export type AuthorizationStep = z.infer<typeof authorizationStepSchema>

/** Por qué un pedido no se autoriza solo (`holdReasons` del front). */
export const holdReasonSchema = z.discriminatedUnion('kind', [
	z.object({
		step: z.literal('commercial'),
		kind: z.literal('noPrice'),
		count: z.number().int().min(1)
	}),
	z.object({ step: z.literal('commercial'), kind: z.literal('inactive') }),
	z.object({ step: z.literal('financial'), kind: z.literal('blocked') }),
	z.object({
		step: z.literal('financial'),
		kind: z.literal('overdue'),
		amount: z.number(),
		days: z.number().int()
	}),
	z.object({
		step: z.literal('financial'),
		kind: z.literal('creditLimit'),
		limit: z.number(),
		exposure: z.number()
	})
])
export type HoldReason = z.infer<typeof holdReasonSchema>

export const orderLineSchema = z.object({
	id: salesIdSchema,
	articleId: z.string().min(1).max(60),
	/** La presentación en la que se pide; `null` = por unidad de stock. */
	presentationId: z.string().min(1).max(60).nullable(),
	perUnit: z.number().positive(),
	quantity: z.number().positive(),
	/** Sin IVA, por unidad de stock, en centavos con dos decimales. Fijo al cargar. */
	unitNetPrice: z.number().min(0),
	discountPct: z.number().min(0).max(100),
	vatRate: vatRateSchema,
	delivered: z.number().min(0),
	invoiced: z.number().min(0),
	returned: z.number().min(0)
})
export type OrderLine = z.infer<typeof orderLineSchema>

export const orderDeliveryNoteRefSchema = z.object({
	number: documentNumberSchema,
	date: isoDateSchema,
	routeSheet: z.string().nullable()
})

export const orderInvoiceRefSchema = z.object({
	letter: z.enum(['A', 'B', 'C', 'E']),
	number: documentNumberSchema,
	date: isoDateSchema
})

const orderFields = {
	customerId: contactIdSchema,
	deliveryPlaceId: z.string().min(1).max(40),
	zone: z.string().max(60).nullable(),
	orderedAt: isoDateSchema,
	deliveryDate: isoDateSchema,
	kind: z.enum(ORDER_KINDS),
	receptionMode: z.string().max(60).nullable(),
	paymentTermId: z.uuid(),
	purchaseOrder: documentNumberSchema.nullable(),
	/** `null` = sin vendedor asignado. */
	salespersonId: contactIdSchema.nullable(),
	/** `null` = «Sin Asignar». */
	carrierId: contactIdSchema.nullable(),
	bonusPct: z.number().min(0).max(100),
	notes: z.object({
		general: z.string().max(2000).nullable(),
		deliveryNote: z.string().max(500).nullable()
	})
}

export const orderSchema = z.object({
	id: salesIdSchema,
	code: airesCodeSchema,
	/** El local del cliente (alcance); `null` = de casa central. */
	localId: z.string().nullable(),
	...orderFields,
	authorization: z.object({
		commercial: authorizationStepSchema.nullable(),
		financial: authorizationStepSchema.nullable()
	}),
	/** Lo que lo retuvo al cargarlo (o editarlo), con la cuenta de ese momento. */
	holdReasons: z.array(holdReasonSchema),
	lines: z.array(orderLineSchema).min(1),
	documents: z.object({
		deliveryNotes: z.array(orderDeliveryNoteRefSchema),
		invoices: z.array(orderInvoiceRefSchema)
	}),
	status: orderStatusSchema,
	stage: orderStageSchema,
	version: z.number().int().min(1),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime()
})
export type Order = z.infer<typeof orderSchema>

export const orderLineInputSchema = orderLineSchema.omit({
	id: true,
	delivered: true,
	invoiced: true,
	returned: true
})
export type OrderLineInput = z.infer<typeof orderLineInputSchema>

export const orderInputSchema = z
	.object({
		...orderFields,
		lines: z.array(orderLineInputSchema).min(1).max(300)
	})
	.refine(order => order.deliveryDate >= order.orderedAt, {
		path: ['deliveryDate'],
		message: 'La entrega no puede ser antes del pedido'
	})
export type OrderInput = z.infer<typeof orderInputSchema>

/**
 * Lo que sales necesita saber del cliente para autorizar solo (lo arma
 * quien llama con contacts y ledger): ningún módulo llama a otro.
 */
export const customerSnapshotSchema = z.object({
	/** El local del cliente en contacts; `null` = de casa central. */
	localId: z.string().nullable(),
	active: z.boolean(),
	financialBlock: z.boolean(),
	/** 0 = sin límite cargado. */
	creditLimit: z.number().int().min(0),
	account: z.object({
		balance: z.number().int(),
		overdue: z.number().int(),
		oldestOverdueDays: z.number().int().min(0)
	})
})
export type CustomerSnapshot = z.infer<typeof customerSnapshotSchema>

/** POST /internal/orders — alta. Con `id` repetido devuelve el que hay (200). */
export const createOrderRequestSchema = z.object({
	id: salesIdSchema.optional(),
	order: orderInputSchema,
	customer: customerSnapshotSchema
})
export type CreateOrderRequest = z.input<typeof createOrderRequestSchema>

/** PUT /internal/orders/:id — sólo abierto y sin nada remitido (`sales.order_locked`). */
export const updateOrderRequestSchema = z.object({
	order: orderInputSchema,
	customer: customerSnapshotSchema,
	expectedVersion: z.number().int().min(1).optional()
})
export type UpdateOrderRequest = z.input<typeof updateOrderRequestSchema>

/** GET /internal/orders */
export const listOrdersQuerySchema = z.object({
	/** Código y orden de compra. */
	query: z.string().trim().max(120).optional(),
	/** Clientes que coinciden con `query` (los busca quien llama): O con `query`. */
	queryCustomerIds: listParam(contactIdSchema),
	stages: listParam(orderStageSchema),
	zones: listParam(z.string().max(60)),
	customerIds: listParam(contactIdSchema),
	deliveryFrom: isoDateSchema.optional(),
	deliveryTo: isoDateSchema.optional(),
	limit: z.coerce.number().int().min(1).max(2000).default(500)
})
export type ListOrdersQuery = z.output<typeof listOrdersQuerySchema>

export const listOrdersResponseSchema = z.object({
	orders: z.array(orderSchema)
})
export const orderResponseSchema = z.object({ order: orderSchema })
export const orderDetailResponseSchema = z.object({
	order: orderSchema,
	history: z.array(historyEntrySchema)
})
export const holdReasonsResponseSchema = z.object({
	reasons: z.array(holdReasonSchema)
})

/** POST /internal/orders/authorize — autoriza a mano lo que falte. 204. */
export const authorizeOrdersRequestSchema = z.object({
	ids: z.array(salesIdSchema).min(1).max(500),
	note: z.string().trim().max(200).nullable()
})

/** GET /internal/customers/:id/order-suggestion?date= */
export const suggestionQuerySchema = z.object({ date: isoDateSchema })
export const suggestionResponseSchema = z.object({
	lines: z.array(orderLineInputSchema)
})
/** GET /internal/customers/:id/last-order?before= */
export const lastOrderQuerySchema = z.object({ before: isoDateSchema })
export const lastOrderResponseSchema = z.object({
	order: orderSchema.nullable()
})

// ---------- Zonas de reparto

/**
 * Qué días reparte una zona y hasta cuándo se puede pedir (`DELIVERY_ZONES`
 * del front). `days`: 0 = domingo … 6 = sábado.
 */
export const deliveryZoneSchema = z.object({
	zone: z.string().trim().min(1).max(60),
	days: z.array(z.number().int().min(0).max(6)).max(7),
	cutoffHour: z.number().int().min(0).max(23),
	daysBefore: z.number().int().min(0).max(14)
})
export type DeliveryZone = z.infer<typeof deliveryZoneSchema>

/** GET /internal/delivery-zones · PUT (reemplaza todas; sólo casa central). */
export const deliveryZonesSchema = z.object({
	zones: z.array(deliveryZoneSchema).max(200)
})
