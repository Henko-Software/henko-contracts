import { z } from 'zod'

import {
	creditClaimSchema,
	creditRequestSchema,
	dateRequestSchema,
	invoiceNumberSchema,
	invoiceVatSchema,
	isoDateSchema,
	perceptionSchema,
	PURCHASE_INVOICE_LETTERS,
	PURCHASE_INVOICE_STATES,
	PURCHASE_ORDER_STATUSES,
	purchaseInvoiceInputSchema,
	purchaseInvoiceLineSchema,
	purchaseOrderInputSchema,
	purchaseOrderLineSchema,
	receptionInputSchema,
	receptionLineSchema,
	truckCheckSchema,
	voidRequestSchema
} from '@henko-software/contracts-purchasing'

import { historyEventSchema, listParam } from './admin/common.js'

/**
 * Compras (`/purchases/orders`, `/purchases/receptions`,
 * `/purchases/invoices`), armadas con `purchasing`. Las formas copian
 * `henko-web/apps/web/src/data/{purchase_orders,receptions,purchase_invoices}/schema.ts`:
 * el BFF pone el nombre de quien cargó, recibió o aceptó (vacío si fue un
 * superadmin y quien mira no lo es) y saca lo interno.
 */

const sixDigits = z.string().regex(/^\d{6}$/)

// ---------- Pedidos a proveedores (flag `purchases.orders`)

export const bffPurchaseOrderSchema = z.object({
	id: z.string(),
	number: sixDigits,
	supplierId: z.string(),
	date: isoDateSchema,
	deliveryDate: isoDateSchema,
	notes: z.string().max(500).nullable(),
	lines: z.array(purchaseOrderLineSchema).min(1),
	sentAt: isoDateSchema.nullable(),
	closedShortAt: isoDateSchema.nullable(),
	invoicedAt: isoDateSchema.nullable(),
	cancelledAt: isoDateSchema.nullable(),
	/** Nombre de quien lo cargó. */
	createdBy: z.string(),
	/** Calculado por purchasing. */
	status: z.enum(PURCHASE_ORDER_STATUSES)
})
export type BffPurchaseOrder = z.infer<typeof bffPurchaseOrderSchema>

/** POST /api/purchase-orders · PUT /api/purchase-orders/:id: `PurchaseOrderInput`. */
export const bffPurchaseOrderInputSchema = purchaseOrderInputSchema

/** GET /api/purchase-orders?query=&statuses=&supplierIds= */
export const listBffPurchaseOrdersQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	statuses: listParam(z.enum(PURCHASE_ORDER_STATUSES)),
	supplierIds: listParam(z.uuid())
})
export type ListBffPurchaseOrdersQuery = z.output<
	typeof listBffPurchaseOrdersQuerySchema
>
export const listPurchaseOrdersBffResponseSchema = z.object({
	orders: z.array(bffPurchaseOrderSchema)
})
/** POST · PUT */
export const purchaseOrderBffResponseSchema = z.object({
	order: bffPurchaseOrderSchema
})
/** GET /api/purchase-orders/:id */
export const purchaseOrderDetailBffResponseSchema = z.object({
	order: bffPurchaseOrderSchema,
	history: z.array(historyEventSchema)
})
/** GET /api/purchase-orders/next-number */
export const purchaseOrderNumberBffResponseSchema = z.object({
	number: sixDigits
})
/** POST /api/purchase-orders/:id/sent · /cancel — 204. */
export const purchaseDateBodySchema = dateRequestSchema

// ---------- Recepciones (flag `purchases.receptions`)

export const bffReceptionSchema = z.object({
	id: z.string(),
	number: sixDigits,
	purchaseOrderId: z.string(),
	supplierId: z.string(),
	date: isoDateSchema,
	time: z.string().regex(/^\d{2}:\d{2}$/),
	deliveryNote: z.string().max(20).nullable(),
	photo: z.string().nullable(),
	truck: truckCheckSchema,
	lines: z.array(receptionLineSchema).min(1),
	notes: z.string().max(500).nullable(),
	closesOrder: z.boolean(),
	/** Nombre de quien recibió. */
	receivedBy: z.string()
})
export type BffReception = z.infer<typeof bffReceptionSchema>

/** POST /api/receptions: `ReceptionInput` del front. */
export const bffReceptionInputSchema = receptionInputSchema

/** GET /api/receptions?query=&supplierIds=&purchaseOrderId= */
export const listBffReceptionsQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	supplierIds: listParam(z.uuid()),
	purchaseOrderId: z.uuid().optional()
})
export type ListBffReceptionsQuery = z.output<
	typeof listBffReceptionsQuerySchema
>
export const listReceptionsBffResponseSchema = z.object({
	receptions: z.array(bffReceptionSchema)
})
/** POST /api/receptions · POST /api/receptions/:id/void */
export const receptionBffResponseSchema = z.object({
	reception: bffReceptionSchema
})
/** GET /api/receptions/:id */
export const receptionDetailBffResponseSchema = z.object({
	reception: bffReceptionSchema,
	history: z.array(historyEventSchema)
})
/** POST /api/receptions/:id/void · /api/purchase-invoices/:id/void */
export const purchaseVoidBodySchema = voidRequestSchema

// ---------- Facturas de compra (flag `purchases.invoices`)

export const bffPurchaseInvoiceSchema = z.object({
	id: z.string(),
	supplierId: z.string(),
	letter: z.enum(PURCHASE_INVOICE_LETTERS),
	number: invoiceNumberSchema,
	date: isoDateSchema,
	dueDate: isoDateSchema,
	cae: z
		.string()
		.regex(/^\d{14}$/)
		.nullable(),
	purchaseOrderId: z.string().nullable(),
	lines: z.array(purchaseInvoiceLineSchema),
	concept: z.string().max(120).nullable(),
	net: z.number().int().min(0),
	nonTaxed: z.number().int().min(0),
	vat: z.array(invoiceVatSchema),
	perceptions: z.array(perceptionSchema),
	total: z.number().int().positive(),
	overcharge: z.number().int().min(0),
	claim: creditClaimSchema.nullable(),
	closesOrder: z.boolean(),
	acceptedAt: isoDateSchema,
	/** Nombre de quien la aceptó. */
	acceptedBy: z.string(),
	/** Lo que queda para pagar y lo retenido hasta la nota de crédito. */
	payable: z.number().int().min(0),
	held: z.number().int().min(0),
	voidedAt: isoDateSchema.nullable()
})
export type BffPurchaseInvoice = z.infer<typeof bffPurchaseInvoiceSchema>

/** POST /api/purchase-invoices: `PurchaseInvoiceInput` del front. */
export const bffPurchaseInvoiceInputSchema = purchaseInvoiceInputSchema

/** GET /api/purchase-invoices?query=&supplierIds=&states=&purchaseOrderId= */
export const listBffPurchaseInvoicesQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	supplierIds: listParam(z.uuid()),
	states: listParam(z.enum(PURCHASE_INVOICE_STATES)),
	purchaseOrderId: z.uuid().optional()
})
export type ListBffPurchaseInvoicesQuery = z.output<
	typeof listBffPurchaseInvoicesQuerySchema
>
export const listPurchaseInvoicesBffResponseSchema = z.object({
	invoices: z.array(bffPurchaseInvoiceSchema)
})
/** POST /api/purchase-invoices · POST …/:id/void */
export const purchaseInvoiceBffResponseSchema = z.object({
	invoice: bffPurchaseInvoiceSchema
})
/** GET /api/purchase-invoices/:id */
export const purchaseInvoiceDetailBffResponseSchema = z.object({
	invoice: bffPurchaseInvoiceSchema,
	history: z.array(historyEventSchema)
})
/** POST /api/purchase-invoices/:id/credit — 204. */
export const purchaseCreditBodySchema = creditRequestSchema
/** POST /api/purchase-invoices/:id/waive — 204: `purchaseDateBodySchema`. */
