import { z } from 'zod'

import {
	articleIdSchema,
	isoDateSchema,
	PRODUCTION_TYPES,
	productionArticleSchema
} from './common.js'
import { productionOrderSchema } from './orders.js'
import { incomingLineSchema } from './stock.js'

/**
 * El plan de producción de una entrega. Copia `buildPlan` de
 * `henko-web/apps/web/src/data/production/rules.ts`:
 *
 * A producir = lo pedido hasta esa entrega que todavía no salió + lo que
 * llevan otros productos del plan + el stock mínimo − lo que hay − lo que
 * está en la cocina, redondeado a la tanda.
 */

/** Cuántas entregas para adelante se planifican (desde mañana). */
export const PLAN_DELIVERY_DATES = 3

/**
 * POST /internal/plan. Lo trae quien llama: pedidos abiertos (sales), lo que
 * hay disponible (stock), lo que viene en camino (purchasing) y los
 * artículos (catalog). Production suma sus órdenes.
 */
export const planRequestSchema = z.object({
	deliveryDate: isoDateSchema,
	/** Cuántos pedidos hay para esa entrega. */
	orderCount: z.number().int().min(0),
	articles: z.array(productionArticleSchema).max(5000),
	/** Lo pedido por artículo, hasta esa entrega y sin lo que ya salió. */
	ordered: z
		.array(z.object({ articleId: articleIdSchema, quantity: z.number() }))
		.max(5000),
	/** Lo que hay por artículo (sin desperdicio ni retenido). */
	inStock: z
		.array(z.object({ articleId: articleIdSchema, quantity: z.number() }))
		.max(5000),
	incoming: z.array(incomingLineSchema).max(5000)
})
export type PlanRequest = z.input<typeof planRequestSchema>

/**
 * - `toArm`: hay que producir y falta armar la orden.
 * - `inKitchen`: la orden está en la cocina.
 * - `done`: ya se cerró lo que hacía falta.
 * - `covered`: alcanza con lo que hay en cámara.
 */
export const PLAN_STATES = ['toArm', 'inKitchen', 'done', 'covered'] as const

export const planRowSchema = z.object({
	articleId: articleIdSchema,
	type: z.enum(PRODUCTION_TYPES),
	ordered: z.number(),
	forOthers: z.number(),
	min: z.number(),
	inStock: z.number(),
	inKitchen: z.number(),
	needed: z.number(),
	batch: z.number(),
	toMake: z.number(),
	orders: z.array(productionOrderSchema),
	state: z.enum(PLAN_STATES)
})
export type PlanRow = z.infer<typeof planRowSchema>

export const shortageSchema = z.object({
	articleId: articleIdSchema,
	needed: z.number(),
	inStock: z.number(),
	missing: z.number(),
	/** Lo pedido a proveedores que todavía no llegó, del primero al último. */
	incoming: z.array(incomingLineSchema.omit({ articleId: true })),
	/** Con lo que llega hasta la entrega, alcanza. */
	covered: z.boolean()
})
export type Shortage = z.infer<typeof shortageSchema>

export const productionPlanSchema = z.object({
	deliveryDate: isoDateSchema,
	orderCount: z.number().int().min(0),
	rows: z.array(planRowSchema),
	shortages: z.array(shortageSchema),
	/** La materia prima que lleva el plan, por artículo. */
	rawNeeds: z.array(
		z.object({ articleId: articleIdSchema, quantity: z.number() })
	)
})
export type ProductionPlan = z.infer<typeof productionPlanSchema>

export const planResponseSchema = z.object({ plan: productionPlanSchema })
