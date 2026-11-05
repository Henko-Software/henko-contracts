import { z } from 'zod'

import {
	actorRefSchema,
	articleIdSchema,
	booleanParam,
	historyEntrySchema,
	isoDateSchema,
	listParam,
	purchasingIdSchema,
	sixDigitsSchema,
	supplierIdSchema
} from './common.js'

/**
 * Recepciones (Aires: Compras › Recepciones): lo que bajó del camión de un
 * proveedor, sobre un pedido. Copia
 * `henko-web/apps/web/src/data/receptions/schema.ts`. Al guardarla, lo
 * aceptado suma a `received` del pedido en la misma transacción.
 */

/** Por qué se devuelve: temperatura, vencido, roto, no es lo pedido, otro. */
export const REJECT_REASONS = [
	'temperature',
	'expiry',
	'damaged',
	'wrong',
	'other'
] as const
export const rejectReasonSchema = z.enum(REJECT_REASONS)

export const receptionLineSchema = z.object({
	articleId: articleIdSchema,
	/** Lo que se aceptó y entra al depósito (unidad de compra). */
	accepted: z.number().min(0),
	/** Lo que se le devuelve al camión. */
	rejected: z.number().min(0),
	rejectReason: rejectReasonSchema.nullable(),
	lot: z.string().trim().max(40).nullable(),
	expiry: isoDateSchema.nullable(),
	/** °C, sólo lo congelado y lo refrigerado. */
	temperature: z.number().min(-40).max(60).nullable()
})
export type ReceptionLine = z.infer<typeof receptionLineSchema>

/** Control del camión del proveedor (Código Alimentario, art. 154 bis). */
export const truckCheckSchema = z.object({
	plate: z.string().trim().min(6).max(10).nullable(),
	clean: z.boolean(),
	permitSeen: z.boolean()
})

const receptionFields = {
	purchaseOrderId: purchasingIdSchema,
	date: isoDateSchema,
	time: z.string().regex(/^\d{2}:\d{2}$/),
	/** Número del remito del proveedor. */
	deliveryNote: z.string().trim().max(20).nullable(),
	/**
	 * Dirección de la foto del remito. Hasta que haya almacenamiento de
	 * archivos, sólo una URL corta (no un `data:`).
	 */
	photo: z.string().max(2048).nullable(),
	truck: truckCheckSchema,
	lines: z.array(receptionLineSchema).min(1).max(300),
	notes: z.string().trim().max(500).nullable(),
	/** Lo que falta no va a llegar: el pedido se cierra por lo recibido. */
	closesOrder: z.boolean().default(false)
}

/** Lo que se carga (`ReceptionInput` del front; el proveedor sale del pedido). */
export const receptionInputSchema = z
	.object({
		...receptionFields,
		/** Lo manda el front; tiene que ser el del pedido. */
		supplierId: supplierIdSchema.optional()
	})
	.refine(
		input => input.lines.some(line => line.accepted + line.rejected > 0),
		{ message: 'Anotá cuánto llegó.', path: ['lines'] }
	)
	.refine(
		input =>
			input.lines.every(line => line.rejected === 0 || line.rejectReason),
		{ message: 'Decí por qué rechazás.', path: ['lines'] }
	)
export type ReceptionInput = z.input<typeof receptionInputSchema>

export const receptionSchema = z.object({
	id: purchasingIdSchema,
	number: sixDigitsSchema,
	localId: z.string().nullable(),
	supplierId: supplierIdSchema,
	...receptionFields,
	closesOrder: z.boolean(),
	receivedBy: actorRefSchema,
	/** Anulada (lo aceptado se le restó al pedido). */
	voidedAt: isoDateSchema.nullable(),
	voidReason: z.string().max(120).nullable(),
	createdAt: z.iso.datetime()
})
export type Reception = z.infer<typeof receptionSchema>

/**
 * GET /internal/receptions — de la más nueva a la más vieja. `query` sobre
 * número, remito, patente y lotes, más los proveedores e insumos que
 * coinciden (los manda quien llama). Las anuladas, sólo con `includeVoided`.
 */
export const listReceptionsQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	querySupplierIds: listParam(z.uuid()),
	queryArticleIds: listParam(articleIdSchema),
	supplierIds: listParam(z.uuid()),
	purchaseOrderId: purchasingIdSchema.optional(),
	includeVoided: booleanParam.optional(),
	limit: z.coerce.number().int().min(1).max(2000).default(500)
})
export type ListReceptionsQuery = z.output<typeof listReceptionsQuerySchema>

export const listReceptionsResponseSchema = z.object({
	receptions: z.array(receptionSchema)
})
export const receptionResponseSchema = z.object({ reception: receptionSchema })
export const receptionDetailResponseSchema = z.object({
	reception: receptionSchema,
	history: z.array(historyEntrySchema)
})

/**
 * POST /internal/receptions — registra lo que llegó y lo suma al pedido.
 * Con `id` repetido no se duplica.
 */
export const createReceptionRequestSchema = z.object({
	id: purchasingIdSchema.optional(),
	reception: receptionInputSchema
})
export type CreateReceptionRequest = z.input<
	typeof createReceptionRequestSchema
>
