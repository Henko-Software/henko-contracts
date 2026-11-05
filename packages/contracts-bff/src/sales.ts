import { z } from 'zod'

import { isoDateSchema } from '@henko-software/contracts-contacts'
import {
	authorizationStatusSchema,
	CREDIT_REASONS,
	DELIVERY_NOTE_STATUSES,
	deliveryNoteIssuerSchema,
	deliveryNoteSchema,
	holdReasonSchema,
	INVOICE_KINDS,
	INVOICE_LETTERS,
	INVOICE_STATUSES,
	invoiceLineSchema,
	ORDER_KINDS,
	ORDER_STAGES,
	ORDER_STATUSES,
	orderLineInputSchema,
	orderLineSchema,
	trayReturnSchema,
	vatConditionSchema
} from '@henko-software/contracts-sales'

import {
	historyEventSchema,
	listParam,
	UNASSIGNED_SALESPERSON_ID
} from './admin/common.js'

/**
 * Ventas (`/sales/orders`, `/sales/expedition`, `/sales/delivery-notes`,
 * `/sales/invoices`, `/sales/trays`), armadas con `sales`. Las formas copian
 * `henko-web/apps/web/src/data/{orders,delivery_notes,invoices}/schema.ts`:
 * el BFF pone nombres donde sales manda actores, traduce el vendedor sin
 * asignar (`sp-000001`) y saca lo interno.
 */

const documentNumberSchema = z.string().regex(/^\d{4}-\d{8}$/)
const airesCode = z.string().regex(/^\d{6}$/)

/** Vendedor: un id de contacts o el de sistema «Sin asignar». */
const salespersonRefSchema = z.union([
	z.uuid(),
	z.literal(UNASSIGNED_SALESPERSON_ID)
])

// ---------- Pedidos (flag `orders.salesOrders`)

export const bffAuthorizationStepSchema = z.object({
	at: z.iso.datetime(),
	/** Nombre de quien autorizó; vacío si fue un superadmin y quien mira no lo es. */
	by: z.string().max(80),
	auto: z.boolean(),
	note: z.string().max(200).nullable()
})

export const bffOrderSchema = z.object({
	id: z.string(),
	code: airesCode,
	customerId: z.string(),
	deliveryPlaceId: z.string(),
	zone: z.string().max(60).nullable(),
	orderedAt: isoDateSchema,
	deliveryDate: isoDateSchema,
	kind: z.enum(ORDER_KINDS),
	receptionMode: z.string().max(60).nullable(),
	paymentTermId: z.string(),
	purchaseOrder: documentNumberSchema.nullable(),
	salespersonId: z.string(),
	carrierId: z.string().nullable(),
	bonusPct: z.number().min(0).max(100),
	authorization: z.object({
		commercial: bffAuthorizationStepSchema.nullable(),
		financial: bffAuthorizationStepSchema.nullable()
	}),
	lines: z.array(orderLineSchema.extend({ id: z.string() })).min(1),
	notes: z.object({
		general: z.string().max(2000).nullable(),
		deliveryNote: z.string().max(500).nullable()
	}),
	documents: z.object({
		deliveryNotes: z.array(
			z.object({
				number: documentNumberSchema,
				date: isoDateSchema,
				routeSheet: z.string().nullable()
			})
		),
		invoices: z.array(
			z.object({
				letter: z.enum(INVOICE_LETTERS),
				number: documentNumberSchema,
				date: isoDateSchema
			})
		)
	}),
	status: z.enum(ORDER_STATUSES)
})
export type BffOrder = z.infer<typeof bffOrderSchema>

/** POST /api/orders · PUT /api/orders/:id: `OrderInput` del front. */
export const bffOrderInputSchema = z
	.object({
		customerId: z.uuid(),
		deliveryPlaceId: z.string().min(1).max(40),
		zone: z.string().max(60).nullable(),
		orderedAt: isoDateSchema,
		deliveryDate: isoDateSchema,
		kind: z.enum(ORDER_KINDS),
		receptionMode: z.string().max(60).nullable(),
		paymentTermId: z.uuid(),
		purchaseOrder: documentNumberSchema.nullable(),
		salespersonId: salespersonRefSchema,
		carrierId: z.uuid().nullable(),
		bonusPct: z.number().min(0).max(100),
		lines: z.array(orderLineInputSchema).min(1).max(300),
		notes: z.object({
			general: z.string().max(2000).nullable(),
			deliveryNote: z.string().max(500).nullable()
		})
	})
	.refine(order => order.deliveryDate >= order.orderedAt, {
		path: ['deliveryDate'],
		message: 'La entrega no puede ser antes del pedido'
	})
export type BffOrderInput = z.infer<typeof bffOrderInputSchema>

/** GET /api/orders?query=&stages=&zones=&customerIds=&deliveryFrom=&deliveryTo= */
export const listBffOrdersQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	stages: listParam(z.enum(ORDER_STAGES)),
	zones: listParam(z.string().max(60)),
	customerIds: listParam(z.uuid()),
	deliveryFrom: isoDateSchema.optional(),
	deliveryTo: isoDateSchema.optional()
})
export type ListBffOrdersQuery = z.output<typeof listBffOrdersQuerySchema>

export const listOrdersBffResponseSchema = z.object({
	orders: z.array(bffOrderSchema)
})
/** POST /api/orders · PUT /api/orders/:id */
export const orderBffResponseSchema = z.object({ order: bffOrderSchema })
/** GET /api/orders/:id */
export const orderDetailBffResponseSchema = z.object({
	order: bffOrderSchema,
	history: z.array(historyEventSchema)
})
/** GET /api/orders/:id/hold-reasons */
export const holdReasonsBffResponseSchema = z.object({
	reasons: z.array(holdReasonSchema)
})
/** POST /api/orders/authorize — 204. */
export const authorizeOrdersBodySchema = z.object({
	ids: z.array(z.uuid()).min(1).max(500),
	note: z.string().trim().max(200).nullable()
})
/** POST /api/orders/close|cancel|restore — 204. */
export const orderIdsBodySchema = z.object({
	ids: z.array(z.uuid()).min(1).max(500)
})
/** GET /api/customers/:id/order-suggestion?date= */
export const orderSuggestionBffResponseSchema = z.object({
	lines: z.array(orderLineInputSchema)
})
/** GET /api/customers/:id/last-order?before= */
export const lastOrderBffResponseSchema = z.object({
	order: bffOrderSchema.nullable()
})

/** GET /api/orders/board?date= — quién pidió y quién falta, por zona. */
export const deliveryBoardBffResponseSchema = z.object({
	board: z.object({
		date: isoDateSchema,
		zones: z.array(
			z.object({
				zone: z.string(),
				cutoff: z.string(),
				rows: z.array(
					z.object({
						customerId: z.string(),
						deliveryPlaceId: z.string(),
						orderId: z.string().nullable()
					})
				)
			})
		),
		extra: z.array(z.string())
	})
})

// ---------- Expedición (flag `orders.expedition`)

export const bffRouteSheetSchema = z.object({
	id: z.string(),
	code: airesCode,
	deliveryDate: isoDateSchema,
	zone: z.string().max(60).nullable(),
	carrierId: z.string().nullable(),
	vehiclePlate: z.string().nullable(),
	createdAt: z.iso.datetime(),
	/** Nombre de quien la armó; vacío si fue un superadmin y quien mira no lo es. */
	createdBy: z.string(),
	stops: z
		.array(
			z.object({
				orderId: z.string(),
				customerId: z.string(),
				deliveryNote: documentNumberSchema,
				packages: z.number().int().min(0),
				trays: z.number().int().min(0)
			})
		)
		.min(1)
})
export type BffRouteSheet = z.infer<typeof bffRouteSheetSchema>

/** GET /api/expedition?date= */
export const expeditionBffResponseSchema = z.object({
	sheets: z.array(
		z.object({
			key: z.string(),
			deliveryDate: isoDateSchema,
			zone: z.string().nullable(),
			carrierId: z.string().nullable(),
			pendingOrderIds: z.array(z.string()),
			heldOrderIds: z.array(z.string()),
			routeSheets: z.array(bffRouteSheetSchema)
		})
	)
})
/** POST /api/expedition/dispatch: `DispatchInput` del front. */
export const dispatchBodySchema = z.object({
	deliveryDate: isoDateSchema,
	zone: z.string().max(60).nullable(),
	carrierId: z.uuid().nullable(),
	vehiclePlate: z.string().max(20).nullable(),
	lines: z
		.array(
			z.object({
				orderId: z.uuid(),
				lineId: z.uuid(),
				quantity: z.number().min(0)
			})
		)
		.min(1)
		.max(2000)
})
export const routeSheetBffResponseSchema = z.object({
	routeSheet: bffRouteSheetSchema
})
/** GET /api/route-sheets?from=&to= */
export const routeSheetsQuerySchema = z.object({
	from: isoDateSchema,
	to: isoDateSchema
})
export const listRouteSheetsBffResponseSchema = z.object({
	routeSheets: z.array(bffRouteSheetSchema)
})

// ---------- Bandejas (flag `orders.trays`)

/** GET /api/trays/returns · PUT /api/route-sheets/:code/tray-returns */
export const trayReturnsBffResponseSchema = z.object({
	returns: z.array(trayReturnSchema)
})
export const receiveTraysBodySchema = z.object({
	lines: z
		.array(
			z.object({ customerId: z.uuid(), quantity: z.number().int().min(0) })
		)
		.min(1)
		.max(500)
})
/** POST /api/customers/:id/tray-counts */
export const countTraysBodySchema = z.object({ counted: z.number() })
export const trayReturnBffResponseSchema = z.object({
	return: trayReturnSchema
})
/** GET /api/trays/balances */
export const trayBalancesBffResponseSchema = z.object({
	balances: z.record(z.string(), z.number().int())
})

// ---------- Remitos (flag `orders.deliveryNotes`)

export const bffDeliveryNoteSchema = deliveryNoteSchema.omit({
	id: true,
	localId: true
})
export type BffDeliveryNote = z.infer<typeof bffDeliveryNoteSchema>

/** GET /api/delivery-notes?query=&statuses=&carrierIds=&customerIds=&dateFrom=&dateTo= */
export const listBffDeliveryNotesQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	statuses: listParam(z.enum(DELIVERY_NOTE_STATUSES)),
	carrierIds: listParam(z.uuid()),
	customerIds: listParam(z.uuid()),
	dateFrom: isoDateSchema.optional(),
	dateTo: isoDateSchema.optional()
})
export const listDeliveryNotesBffResponseSchema = z.object({
	deliveryNotes: z.array(bffDeliveryNoteSchema)
})
/** GET /api/delivery-notes/:number */
export const deliveryNoteBffResponseSchema = z.object({
	deliveryNote: bffDeliveryNoteSchema
})
/** GET /api/settings/fiscal/delivery-notes */
export const deliveryNoteIssuerBffResponseSchema = z.object({
	issuer: deliveryNoteIssuerSchema
})

// ---------- Facturas (flag `orders.invoices`)

/**
 * La factura como la usa el front. Sin CAE todavía (`authorization.status`
 * `pending`), `number` viene con el punto de venta y ceros
 * (`0002-00000000`): el número lo da ARCA al autorizar.
 */
export const bffInvoiceSchema = z.object({
	id: z.string(),
	kind: z.enum(INVOICE_KINDS),
	letter: z.enum(INVOICE_LETTERS),
	number: documentNumberSchema,
	date: isoDateSchema,
	customerId: z.string(),
	deliveryPlaceId: z.string().nullable(),
	receiver: z.object({
		vatCondition: vatConditionSchema,
		docNumber: z.string().max(20)
	}),
	paymentTermId: z.string(),
	salespersonId: z.string(),
	priceListId: z.string(),
	bonusPct: z.number().min(0).max(100),
	lines: z.array(invoiceLineSchema.extend({ id: z.string() })).min(1),
	cae: z
		.object({ number: z.string().regex(/^\d{14}$/), dueDate: isoDateSchema })
		.nullable(),
	relatedInvoiceId: z.string().nullable(),
	creditReason: z.enum(CREDIT_REASONS).nullable(),
	notes: z.string().max(2000).nullable(),
	sent: z.array(
		z.object({
			channel: z.enum(['email', 'whatsapp']),
			at: z.iso.datetime()
		})
	),
	status: z.enum(INVOICE_STATUSES),
	/** Nuevo: dónde está el pedido de CAE (`pending` = falta; se reintenta). */
	authorization: z.object({
		status: authorizationStatusSchema,
		type: z.enum(['CAE', 'CAEA']).nullable(),
		errors: z.array(z.object({ code: z.number(), message: z.string() }))
	})
})
export type BffInvoice = z.infer<typeof bffInvoiceSchema>

/** GET /api/invoices?query=&kinds=&statuses=&unsent=&dateFrom=&dateTo=&customerIds= */
export const listBffInvoicesQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	kinds: listParam(z.enum(INVOICE_KINDS)),
	statuses: listParam(z.enum(INVOICE_STATUSES)),
	unsent: z
		.enum(['true', 'false'])
		.transform(v => v === 'true')
		.optional(),
	dateFrom: isoDateSchema.optional(),
	dateTo: isoDateSchema.optional(),
	customerIds: listParam(z.uuid())
})
export const listInvoicesBffResponseSchema = z.object({
	invoices: z.array(bffInvoiceSchema)
})
/** GET /api/invoices/:id */
export const invoiceDetailBffResponseSchema = z.object({
	invoice: bffInvoiceSchema,
	related: z.array(bffInvoiceSchema),
	history: z.array(historyEventSchema)
})
export const invoiceBffResponseSchema = z.object({ invoice: bffInvoiceSchema })

export const INVOICE_BLOCKERS = ['no_vat', 'bad_cuit'] as const
/** GET /api/invoices/pending — `ToInvoice[]` del front. */
export const pendingInvoicesBffResponseSchema = z.object({
	pending: z.array(
		z.object({
			orderId: z.string(),
			orderCode: z.string(),
			customerId: z.string(),
			deliveryDate: isoDateSchema,
			deliveryNotes: z.array(z.string()),
			total: z.number().int(),
			blockers: z.array(z.enum(INVOICE_BLOCKERS))
		})
	)
})
/** POST /api/invoices/from-orders */
export const invoiceOrdersBodySchema = z.object({
	orderIds: z.array(z.uuid()).min(1).max(200),
	date: isoDateSchema
})
export const invoicesBffResponseSchema = z.object({
	invoices: z.array(bffInvoiceSchema)
})
/** POST /api/invoices/:id/credit-notes: `CreditNoteInput` del front. */
export const creditNoteBodySchema = z.object({
	invoiceId: z.string().optional(),
	lines: z
		.array(z.object({ lineId: z.uuid(), quantity: z.number().positive() }))
		.min(1)
		.max(500),
	reason: z.enum(CREDIT_REASONS),
	notes: z.string().max(2000).nullable(),
	date: isoDateSchema.optional()
})
/** POST /api/invoices/sent — 204. */
export const markSentBodySchema = z.object({
	ids: z.array(z.uuid()).min(1).max(500),
	channel: z.enum(['email', 'whatsapp'])
})
// POST /api/invoices/:id/retry-cae → `invoiceBffResponseSchema`.
