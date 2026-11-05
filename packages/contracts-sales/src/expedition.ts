import { z } from 'zod'

import { listParam } from '@henko-software/contracts-common'

import {
	actorRefSchema,
	airesCodeSchema,
	contactIdSchema,
	documentNumberSchema,
	isoDateSchema,
	salesIdSchema
} from './common.js'

/**
 * Expedición, hojas de ruta, remitos y bandejas. Copia
 * `henko-web/apps/web/src/data/{orders,delivery_notes}/schema.ts`. El
 * remito es una entidad propia con sus líneas: un pedido puede salir en
 * dos remitos.
 */

// ---------- Hojas de ruta

export const routeStopSchema = z.object({
	orderId: salesIdSchema,
	customerId: contactIdSchema,
	deliveryNote: documentNumberSchema,
	packages: z.number().int().min(0),
	trays: z.number().int().min(0)
})

export const routeSheetSchema = z.object({
	id: salesIdSchema,
	code: airesCodeSchema,
	deliveryDate: isoDateSchema,
	zone: z.string().max(60).nullable(),
	carrierId: contactIdSchema.nullable(),
	vehiclePlate: z.string().max(20).nullable(),
	createdAt: z.iso.datetime(),
	createdBy: actorRefSchema,
	stops: z.array(routeStopSchema).min(1)
})
export type RouteSheet = z.infer<typeof routeSheetSchema>

/**
 * POST /internal/expedition/dispatch — «Generar remitos»: un remito por
 * pedido con lo que sale y la hoja de ruta del viaje. Todo o nada:
 * `sales.order_not_dispatchable` si un pedido ya no está para armar,
 * `sales.nothing_to_dispatch` si no sale nada.
 */
export const dispatchRequestSchema = z.object({
	deliveryDate: isoDateSchema,
	zone: z.string().max(60).nullable(),
	carrierId: contactIdSchema.nullable(),
	vehiclePlate: z.string().max(20).nullable(),
	lines: z
		.array(
			z.object({
				orderId: salesIdSchema,
				lineId: salesIdSchema,
				quantity: z.number().min(0)
			})
		)
		.min(1)
		.max(2000),
	/**
	 * Las presentaciones con envase retornable (bandejas), para contar las
	 * bandejas de cada parada. Las sabe quien llama (catalog).
	 */
	trayPresentationIds: z.array(z.string().min(1).max(60)).max(500).default([])
})
export type DispatchRequest = z.input<typeof dispatchRequestSchema>

export const routeSheetResponseSchema = z.object({
	routeSheet: routeSheetSchema
})
export const listRouteSheetsResponseSchema = z.object({
	routeSheets: z.array(routeSheetSchema)
})

/** Una planilla de expedición: día + zona + transportista (`sheetKey`). */
export const expeditionSheetSchema = z.object({
	key: z.string(),
	deliveryDate: isoDateSchema,
	zone: z.string().nullable(),
	carrierId: contactIdSchema.nullable(),
	pendingOrderIds: z.array(salesIdSchema),
	heldOrderIds: z.array(salesIdSchema),
	routeSheets: z.array(routeSheetSchema)
})
/** GET /internal/expedition?date= */
export const expeditionResponseSchema = z.object({
	sheets: z.array(expeditionSheetSchema)
})

// ---------- Remitos

/** `cancelled`: anulado (sólo si no se facturó nada); lo remitido vuelve al pedido. */
export const DELIVERY_NOTE_STATUSES = [
	'to_invoice',
	'invoiced',
	'cancelled'
] as const
export const deliveryNoteStatusSchema = z.enum(DELIVERY_NOTE_STATUSES)

export const deliveryNoteLineSchema = z.object({
	orderLineId: salesIdSchema,
	articleId: z.string(),
	presentationId: z.string().nullable(),
	perUnit: z.number().positive(),
	delivered: z.number().min(0),
	invoiced: z.number().min(0),
	returned: z.number().min(0)
})

export const deliveryNoteSchema = z.object({
	id: salesIdSchema,
	number: documentNumberSchema,
	code: airesCodeSchema,
	date: isoDateSchema,
	localId: z.string().nullable(),
	customerId: contactIdSchema,
	deliveryPlaceId: z.string(),
	orderId: salesIdSchema,
	orderCode: airesCodeSchema,
	carrierId: contactIdSchema.nullable(),
	vehiclePlate: z.string().nullable(),
	routeSheet: airesCodeSchema.nullable(),
	zone: z.string().nullable(),
	notes: z.string().nullable(),
	lines: z.array(deliveryNoteLineSchema).min(1),
	packages: z.number().int().min(0),
	trays: z.number().int().min(0),
	status: deliveryNoteStatusSchema,
	invoice: z
		.object({
			letter: z.enum(['A', 'B', 'C', 'E']),
			number: documentNumberSchema,
			date: isoDateSchema
		})
		.nullable()
})
export type DeliveryNote = z.infer<typeof deliveryNoteSchema>

/** GET /internal/delivery-notes. Sin fechas: los últimos 30 días y los próximos 7. */
export const listDeliveryNotesQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	queryCustomerIds: listParam(contactIdSchema),
	statuses: listParam(deliveryNoteStatusSchema),
	carrierIds: listParam(contactIdSchema),
	customerIds: listParam(contactIdSchema),
	dateFrom: isoDateSchema.optional(),
	dateTo: isoDateSchema.optional()
})
export type ListDeliveryNotesQuery = z.output<
	typeof listDeliveryNotesQuerySchema
>
export const listDeliveryNotesResponseSchema = z.object({
	deliveryNotes: z.array(deliveryNoteSchema)
})
/** GET /internal/delivery-notes/:number — `sales.delivery_note_not_found`. */
export const deliveryNoteResponseSchema = z.object({
	deliveryNote: deliveryNoteSchema
})

/**
 * POST /internal/delivery-notes — un remito a mano, sin pasar por
 * Expedición (Aires: «Agregar»). Sin hoja de ruta. Mismas reglas que
 * «Generar remitos»: el pedido tiene que estar autorizado
 * (`sales.order_not_dispatchable`) y salir algo (`sales.nothing_to_dispatch`).
 */
export const createDeliveryNoteRequestSchema = z.object({
	orderId: salesIdSchema,
	date: isoDateSchema,
	carrierId: contactIdSchema.nullable().default(null),
	vehiclePlate: z.string().trim().max(20).nullable().default(null),
	lines: z
		.array(z.object({ lineId: salesIdSchema, quantity: z.number().min(0) }))
		.min(1)
		.max(500),
	/** Las presentaciones que viajan en bandeja (para contar bandejas). */
	trayPresentationIds: z.array(z.string()).max(200).default([])
})
export type CreateDeliveryNoteRequest = z.input<
	typeof createDeliveryNoteRequestSchema
>

/**
 * POST /internal/delivery-notes/:number/void — anula un remito sin nada
 * facturado ni devuelto (`sales.delivery_note_not_voidable`). Lo remitido
 * vuelve al pedido y las bandejas dejan de contar.
 */
export const voidDeliveryNoteRequestSchema = z.object({
	reason: z.string().trim().min(1).max(500)
})

/** GET /internal/delivery-notes/issuer — los datos de la central (Anexo V RG 1415). */
export const deliveryNoteIssuerSchema = z.object({
	legalName: z.string(),
	address: z.string(),
	cuit: z.string(),
	iibb: z.string(),
	activityStart: z.string(),
	pointOfSale: z.string(),
	cai: z.string(),
	caiDue: z.string()
})
export const deliveryNoteIssuerResponseSchema = z.object({
	issuer: deliveryNoteIssuerSchema
})

// ---------- Bandejas

export const trayReturnSchema = z.object({
	id: salesIdSchema,
	customerId: contactIdSchema,
	date: isoDateSchema,
	routeSheet: airesCodeSchema.nullable(),
	source: z.enum(['route', 'count']),
	quantity: z.number().int()
})
export type TrayReturn = z.infer<typeof trayReturnSchema>

/** PUT /internal/route-sheets/:code/tray-returns — reemplaza lo de ese viaje. */
export const receiveTraysRequestSchema = z.object({
	lines: z
		.array(
			z.object({
				customerId: contactIdSchema,
				quantity: z.number().int().min(0)
			})
		)
		.min(1)
		.max(500)
})
/** POST /internal/customers/:id/tray-counts */
export const countTraysRequestSchema = z.object({
	counted: z.number().int().min(0)
})
export const trayReturnsResponseSchema = z.object({
	returns: z.array(trayReturnSchema)
})
export const trayReturnResponseSchema = z.object({ return: trayReturnSchema })
/** GET /internal/trays/balances — bandejas en cada local. */
export const trayBalancesResponseSchema = z.object({
	balances: z.record(z.string(), z.number().int())
})
