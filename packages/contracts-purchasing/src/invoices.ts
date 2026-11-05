import { z } from 'zod'

import {
	actorRefSchema,
	articleIdSchema,
	booleanParam,
	historyEntrySchema,
	invoiceNumberSchema,
	isoDateSchema,
	listParam,
	provinceSchema,
	purchasingIdSchema,
	supplierIdSchema,
	vatRateSchema
} from './common.js'

/**
 * Facturas de compra (Aires: Compras › Compras): la factura de un
 * proveedor, cargada sobre lo que llegó de un pedido o sin pedido (un
 * servicio, un gasto). Copia
 * `henko-web/apps/web/src/data/purchase_invoices/schema.ts`. Al aceptarla
 * va a la cuenta corriente del proveedor por `purchases.document.recorded.v1`
 * (contracts-ledger) y el pedido se cierra si corresponde.
 */

/** A, B, C, M; la X no da crédito de IVA (pregunta 72). */
export const PURCHASE_INVOICE_LETTERS = ['A', 'B', 'C', 'M', 'X'] as const
export const purchaseInvoiceLetterSchema = z.enum(PURCHASE_INVOICE_LETTERS)
export type PurchaseInvoiceLetter = z.infer<typeof purchaseInvoiceLetterSchema>

export const purchaseInvoiceLineSchema = z.object({
	articleId: articleIdSchema,
	quantity: z.number().positive(),
	/** Centavos sin IVA por unidad de compra. */
	unitPrice: z.number().int().min(0)
})
export type PurchaseInvoiceLine = z.infer<typeof purchaseInvoiceLineSchema>

export const invoiceVatSchema = z.object({
	rate: vatRateSchema.exclude(['not_taxed']),
	amount: z.number().int().min(0)
})

export const PERCEPTION_KINDS = ['vat', 'iibb'] as const
export const perceptionSchema = z
	.object({
		kind: z.enum(PERCEPTION_KINDS),
		province: provinceSchema.nullable(),
		amount: z.number().int().positive()
	})
	.refine(row => row.kind === 'vat' || row.province !== null, {
		path: ['province'],
		message: 'Elegí la provincia.'
	})

/** `credited`: llegó la nota de crédito; `waived`: se pagó entera. */
export const CLAIM_RESOLUTIONS = ['credited', 'waived'] as const
export const creditClaimSchema = z.object({
	amount: z.number().int().positive(),
	requestedAt: isoDateSchema,
	resolution: z.enum(CLAIM_RESOLUTIONS).nullable(),
	resolvedAt: isoDateSchema.nullable(),
	creditNoteNumber: invoiceNumberSchema.nullable(),
	creditedAmount: z.number().int().min(0).nullable()
})
export type CreditClaim = z.infer<typeof creditClaimSchema>

/** `purchaseInvoiceState` del front. */
export const PURCHASE_INVOICE_STATES = [
	'match',
	'claimed',
	'credited',
	'paidAnyway',
	'noOrder'
] as const
export const purchaseInvoiceStateSchema = z.enum(PURCHASE_INVOICE_STATES)
export type PurchaseInvoiceState = z.infer<typeof purchaseInvoiceStateSchema>

/** Un peso de diferencia por redondeo entre el total y la suma. */
export const TOTAL_TOLERANCE = 100

const invoiceFields = {
	supplierId: supplierIdSchema,
	letter: purchaseInvoiceLetterSchema,
	number: invoiceNumberSchema,
	date: isoDateSchema,
	dueDate: isoDateSchema,
	cae: z
		.string()
		.regex(/^\d{14}$/)
		.nullable(),
	purchaseOrderId: purchasingIdSchema.nullable(),
	lines: z.array(purchaseInvoiceLineSchema).max(300),
	concept: z.string().trim().max(120).nullable(),
	net: z.number().int().min(0),
	nonTaxed: z.number().int().min(0),
	vat: z.array(invoiceVatSchema).max(3),
	perceptions: z.array(perceptionSchema).max(30),
	total: z.number().int().positive(),
	closesOrder: z.boolean()
}

type InvoiceShape = z.infer<z.ZodObject<typeof invoiceFields>>

const sumOf = (invoice: InvoiceShape) =>
	invoice.net +
	invoice.nonTaxed +
	invoice.vat.reduce((sum, row) => sum + row.amount, 0) +
	invoice.perceptions.reduce((sum, row) => sum + row.amount, 0)

/** Las mismas validaciones que el formulario del front. */
const refineInvoice = (invoice: InvoiceShape, ctx: z.RefinementCtx) => {
	if (invoice.purchaseOrderId && invoice.lines.length === 0)
		ctx.addIssue({
			code: 'custom',
			path: ['lines'],
			message: 'Falta lo que factura.'
		})
	if (!invoice.purchaseOrderId && !invoice.concept)
		ctx.addIssue({
			code: 'custom',
			path: ['concept'],
			message: 'Contá qué se compró.'
		})
	if (Math.abs(sumOf(invoice) - invoice.total) > TOTAL_TOLERANCE)
		ctx.addIssue({
			code: 'custom',
			path: ['total'],
			message: 'No coincide con la suma de neto, IVA y percepciones.'
		})
	if (invoice.dueDate < invoice.date)
		ctx.addIssue({
			code: 'custom',
			path: ['dueDate'],
			message: 'No puede vencer antes de la fecha de la factura.'
		})
}

/**
 * Lo que se carga (`PurchaseInvoiceInput` del front). `requestCredit`:
 * pedir nota de crédito por lo cobrado de más (si no, se paga entera).
 */
export const purchaseInvoiceInputSchema = z
	.object({ ...invoiceFields, requestCredit: z.boolean() })
	.superRefine(refineInvoice)
export type PurchaseInvoiceInput = z.input<typeof purchaseInvoiceInputSchema>

export const purchaseInvoiceSchema = z.object({
	id: purchasingIdSchema,
	localId: z.string().nullable(),
	...invoiceFields,
	/** Lo cobrado de más contra lo pedido y lo recibido, con IVA. */
	overcharge: z.number().int().min(0),
	claim: creditClaimSchema.nullable(),
	/** Calculado: `purchaseInvoiceState` del front. */
	state: purchaseInvoiceStateSchema,
	/** Lo que hay que pagar: total menos lo retenido y lo acreditado. */
	payable: z.number().int().min(0),
	/** Lo retenido hasta que llegue la nota de crédito. */
	held: z.number().int().min(0),
	acceptedAt: isoDateSchema,
	acceptedBy: actorRefSchema,
	voidedAt: isoDateSchema.nullable(),
	voidReason: z.string().max(120).nullable(),
	version: z.number().int().min(1),
	createdAt: z.iso.datetime()
})
export type PurchaseInvoice = z.infer<typeof purchaseInvoiceSchema>

/**
 * GET /internal/purchase-invoices — de la más nueva a la más vieja. `query`
 * sobre letra y número, concepto y los proveedores, pedidos e insumos que
 * coinciden (los manda quien llama). Las anuladas, sólo con `includeVoided`.
 */
export const listPurchaseInvoicesQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	querySupplierIds: listParam(z.uuid()),
	queryArticleIds: listParam(articleIdSchema),
	supplierIds: listParam(z.uuid()),
	states: listParam(purchaseInvoiceStateSchema),
	purchaseOrderId: purchasingIdSchema.optional(),
	dateFrom: isoDateSchema.optional(),
	dateTo: isoDateSchema.optional(),
	includeVoided: booleanParam.optional(),
	limit: z.coerce.number().int().min(1).max(2000).default(500)
})
export type ListPurchaseInvoicesQuery = z.output<
	typeof listPurchaseInvoicesQuerySchema
>

export const listPurchaseInvoicesResponseSchema = z.object({
	invoices: z.array(purchaseInvoiceSchema)
})
export const purchaseInvoiceResponseSchema = z.object({
	invoice: purchaseInvoiceSchema
})
export const purchaseInvoiceDetailResponseSchema = z.object({
	invoice: purchaseInvoiceSchema,
	history: z.array(historyEntrySchema)
})

/**
 * POST /internal/purchase-invoices — acepta la factura. `vatRates`: la
 * alícuota de cada insumo (de catalog, la trae quien llama) para el IVA de
 * lo cobrado de más; sin dato, 21 %. Con `id` repetido no se duplica.
 */
export const createPurchaseInvoiceRequestSchema = z.object({
	id: purchasingIdSchema.optional(),
	localId: z.string().min(1).max(40).nullable().default(null),
	invoice: purchaseInvoiceInputSchema,
	vatRates: z.record(articleIdSchema, vatRateSchema).default({})
})
export type CreatePurchaseInvoiceRequest = z.input<
	typeof createPurchaseInvoiceRequestSchema
>

/** POST /internal/purchase-invoices/:id/credit — llegó la nota de crédito. */
export const creditRequestSchema = z.object({
	number: invoiceNumberSchema,
	amount: z.number().int().positive(),
	date: isoDateSchema
})
export type CreditRequest = z.infer<typeof creditRequestSchema>
