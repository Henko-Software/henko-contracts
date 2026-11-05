import { z } from 'zod'

import {
	isoDateSchema,
	lotSummarySchema,
	lotTraceSchema,
	PLAN_STATES,
	PRODUCTION_ORDER_STATES,
	PRODUCTION_TYPES,
	productionInputSchema,
	RECALL_KINDS,
	recallInputSchema,
	shortageSchema
} from '@henko-software/contracts-production'

/**
 * Producción (`/production/plan`) y trazabilidad
 * (`/production/traceability`), armadas con `production`. Las formas copian
 * `henko-web/apps/web/src/data/{production,traceability}/schema.ts` y
 * `rules.ts`: el BFF trae los pedidos (sales), el stock (stock), lo que
 * viene en camino (purchasing) y los artículos (catalog), y pone el nombre
 * de quien hizo cada cosa (vacío si fue un superadmin y quien mira no lo
 * es).
 */

// ---------- Producción (flag `production.plan`)

export const bffProductionOrderSchema = z.object({
	id: z.string(),
	/** «009301». */
	number: z.string(),
	articleId: z.string(),
	type: z.enum(PRODUCTION_TYPES),
	deliveryDate: isoDateSchema,
	planned: z.number().positive(),
	state: z.enum(PRODUCTION_ORDER_STATES),
	/** El día en que se armó (hora de Argentina). */
	createdAt: isoDateSchema,
	createdBy: z.string(),
	produced: z.number().min(0).nullable(),
	lot: z.string().nullable(),
	expiry: isoDateSchema.nullable(),
	locationId: z.string().nullable(),
	inputs: z.array(productionInputSchema),
	/** El día de elaboración. */
	closedAt: isoDateSchema.nullable(),
	closedBy: z.string().nullable()
})
export type BffProductionOrder = z.infer<typeof bffProductionOrderSchema>

/** GET /api/production/delivery-dates: hasta tres, desde mañana. */
export const bffDeliveryDatesResponseSchema = z.object({
	dates: z.array(isoDateSchema)
})

/** GET /api/production/plan?deliveryDate= */
export const bffPlanQuerySchema = z.object({ deliveryDate: isoDateSchema })

export const bffPlanRowSchema = z.object({
	articleId: z.string(),
	type: z.enum(PRODUCTION_TYPES),
	ordered: z.number(),
	forOthers: z.number(),
	min: z.number(),
	inStock: z.number(),
	inKitchen: z.number(),
	needed: z.number(),
	batch: z.number(),
	toMake: z.number(),
	orders: z.array(bffProductionOrderSchema),
	state: z.enum(PLAN_STATES)
})

export const bffProductionPlanSchema = z.object({
	deliveryDate: isoDateSchema,
	orderCount: z.number().int().min(0),
	rows: z.array(bffPlanRowSchema),
	shortages: z.array(shortageSchema),
	/** La materia prima del plan (el front la vuelve un `Map`). */
	rawNeeds: z.array(z.object({ articleId: z.string(), quantity: z.number() }))
})
export const bffPlanResponseSchema = z.object({ plan: bffProductionPlanSchema })

/** GET /api/production/orders?deliveryFrom=&deliveryTo= */
export const listBffProductionOrdersQuerySchema = z.object({
	deliveryFrom: isoDateSchema.optional(),
	deliveryTo: isoDateSchema.optional()
})
export const listBffProductionOrdersResponseSchema = z.object({
	orders: z.array(bffProductionOrderSchema)
})

/** POST /api/production/orders: una orden por producto. */
export const bffCreateProductionOrdersBodySchema = z.object({
	deliveryDate: isoDateSchema,
	rows: z
		.array(z.object({ articleId: z.string(), quantity: z.number().positive() }))
		.min(1)
		.max(500)
})

/** PUT /api/production/orders/:id: corregir lo mandado (abierta). */
export const bffUpdateProductionOrderBodySchema = z.object({
	planned: z.number().positive()
})

/** POST /api/production/orders/:id/close */
export const bffCloseProductionOrderBodySchema = z.object({
	produced: z.number().positive(),
	inputs: z.array(productionInputSchema).max(200)
})

export const bffProductionOrderResponseSchema = z.object({
	order: bffProductionOrderSchema
})

// ---------- Trazabilidad (flag `production.traceability`)

/** GET /api/lots?q= */
export const bffFindLotsQuerySchema = z.object({
	q: z.string().trim().max(120).optional()
})
export const bffFindLotsResponseSchema = z.object({
	lots: z.array(lotSummarySchema)
})

/** GET /api/lots/:articleId/:lot/trace */
export const bffLotTraceResponseSchema = z.object({ trace: lotTraceSchema })

export const bffRecallSchema = z.object({
	id: z.string(),
	number: z.string(),
	kind: z.enum(RECALL_KINDS),
	articleId: z.string(),
	lot: z.string(),
	reason: z.string().nullable(),
	startedAt: z.iso.datetime(),
	startedBy: z.string(),
	closedAt: z.iso.datetime().nullable(),
	closedBy: z.string().nullable(),
	heldKg: z.number().min(0),
	shippedKg: z.number().min(0),
	stores: z.array(
		z.object({
			customerId: z.string(),
			reachedAt: z.iso.datetime().nullable()
		})
	)
})
export type BffRecall = z.infer<typeof bffRecallSchema>

/** GET /api/recalls */
export const listBffRecallsResponseSchema = z.object({
	recalls: z.array(bffRecallSchema)
})
/** GET /api/recalls/:id · POST · PUT …/stores/:customerId · POST …/close */
export const bffRecallResponseSchema = z.object({ recall: bffRecallSchema })

/** POST /api/recalls: un retiro (con motivo) o un simulacro. */
export const bffStartRecallBodySchema = recallInputSchema

/** PUT /api/recalls/:id/stores/:customerId */
export const bffMarkRecallStoreBodySchema = z.object({ reached: z.boolean() })
