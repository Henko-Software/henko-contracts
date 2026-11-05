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

/**
 * Un renglón de lo que se carga. Sin pedido (pregunta 74), `unitPrice` es
 * el precio por unidad de compra (centavos sin IVA) del pedido que se arma
 * con lo que llegó; si no viene, el BFF pone el costo del catálogo. Con
 * pedido no se usa (manda el del pedido).
 */
export const receptionLineInputSchema = receptionLineSchema.extend({
	unitPrice: z.number().int().min(0).nullable().optional()
})
export type ReceptionLineInput = z.input<typeof receptionLineInputSchema>

/** Tope de la foto del remito ya decodificada, en bytes. */
export const RECEPTION_PHOTO_MAX_BYTES = 5 * 1024 * 1024

/** Tope del `data:` URL de la foto (base64 + el prefijo). */
export const RECEPTION_PHOTO_MAX_DATA_URL =
	Math.ceil((RECEPTION_PHOTO_MAX_BYTES * 4) / 3) + 100

/** Una dirección de afuera (≤ 2048) o la foto como `data:…;base64,…`. */
export const receptionPhotoInputSchema = z
	.string()
	.max(RECEPTION_PHOTO_MAX_DATA_URL)
	.refine(value => value.startsWith('data:') || value.length <= 2048, {
		message: 'La dirección de la foto es demasiado larga.'
	})

/** Lo que se sabe de la foto guardada por purchasing (los bytes, por `GET …/photo`). */
export const receptionPhotoFileSchema = z.object({
	contentType: z.string().min(1).max(100),
	size: z.number().int().min(1).max(RECEPTION_PHOTO_MAX_BYTES),
	updatedAt: z.iso.datetime()
})
export type ReceptionPhotoFile = z.infer<typeof receptionPhotoFileSchema>

/** Control del camión del proveedor (Código Alimentario, art. 154 bis). */
export const truckCheckSchema = z.object({
	plate: z.string().trim().min(6).max(10).nullable(),
	clean: z.boolean(),
	permitSeen: z.boolean()
})

const receptionFields = {
	date: isoDateSchema,
	time: z.string().regex(/^\d{2}:\d{2}$/),
	/** Número del remito del proveedor. */
	deliveryNote: z.string().trim().max(20).nullable(),
	truck: truckCheckSchema,
	notes: z.string().trim().max(500).nullable(),
	/** Lo que falta no va a llegar: el pedido se cierra por lo recibido. */
	closesOrder: z.boolean().default(false)
}

/**
 * Lo que se carga (`ReceptionInput` del front). Con pedido, el proveedor
 * sale del pedido. Sin pedido (`purchaseOrderId: null`, pregunta 74), va el
 * proveedor y purchasing arma un pedido con lo que llegó, ya cerrado, así
 * Facturas de compra tiene contra qué comparar.
 */
export const receptionInputSchema = z
	.object({
		...receptionFields,
		purchaseOrderId: purchasingIdSchema.nullable(),
		/** Con pedido, tiene que ser el del pedido; sin pedido, obligatorio. */
		supplierId: supplierIdSchema.optional(),
		/**
		 * La foto del remito: el `data:` URL que arma el celular (se guarda como
		 * archivo) o una dirección de afuera.
		 */
		photo: receptionPhotoInputSchema.nullable(),
		lines: z.array(receptionLineInputSchema).min(1).max(300)
	})
	.refine(input => input.purchaseOrderId !== null || input.supplierId, {
		message: 'Sin pedido, elegí el proveedor.',
		path: ['supplierId']
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
	/** El pedido; sin pedido, el que se armó con lo que llegó. */
	purchaseOrderId: purchasingIdSchema,
	supplierId: supplierIdSchema,
	...receptionFields,
	/** Dirección de afuera; `null` si no hay o si está guardada (`photoFile`). */
	photo: z.string().max(2048).nullable(),
	/** La foto guardada por purchasing (`GET /internal/receptions/:id/photo`). */
	photoFile: receptionPhotoFileSchema.nullable(),
	lines: z.array(receptionLineSchema).min(1).max(300),
	/** Se recibió sin pedido: el pedido se armó con lo que llegó. */
	withoutOrder: z.boolean(),
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

/** GET /internal/receptions/:id/photo — la foto guardada, en base64. */
export const receptionPhotoResponseSchema = z.object({
	contentType: z.string(),
	data: z.string()
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
