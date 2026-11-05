import { z } from 'zod'

import { listParam } from '@henko-software/contracts-common'

import {
	airesCodeSchema,
	catalogIdSchema,
	recordStatusSchema
} from './common.js'

/**
 * Bonificaciones por escala (Aires: Administración › Bonificaciones
 * escalas): cuanto más compra un cliente en el período, más porcentaje.
 * Copia `henko-web/apps/web/src/data/discount_scales/schema.ts`.
 */

/** En qué se miden los tramos: plata (centavos) o unidades. */
export const DISCOUNT_UNITS = ['amount', 'quantity'] as const
export const discountUnitSchema = z.enum(DISCOUNT_UNITS)
export type DiscountUnit = z.infer<typeof discountUnitSchema>

export const discountTierSchema = z.object({
	from: z.number().min(0),
	/** `null` = sin tope (sólo el último). */
	to: z.number().min(0).nullable(),
	percent: z.number().min(0).max(100)
})
export type DiscountTier = z.infer<typeof discountTierSchema>

/**
 * ¿Los tramos van uno detrás del otro? Cada «desde» es el «hasta» del
 * anterior, sin huecos ni pisadas, «hasta» mayor que «desde», y sólo el
 * último sin tope. Es la regla `tierProblems` del front.
 */
const chainedTiers = (tiers: DiscountTier[]): boolean =>
	tiers.every((tier, index) => {
		if (tier.to !== null && tier.to <= tier.from) return false
		if (tier.to === null && index < tiers.length - 1) return false
		const previous = tiers[index - 1]
		return previous?.to == null || tier.from === previous.to
	})

const tiersSchema = z
	.array(discountTierSchema)
	.min(1)
	.max(12)
	.refine(chainedTiers, 'Los tramos tienen huecos o se pisan')

export const discountScaleFieldsSchema = z.object({
	name: z.string().trim().min(1).max(80),
	unit: discountUnitSchema,
	tiers: tiersSchema,
	/** Clientes (ids de contacts) a los que se aplica. */
	customerIds: z.array(z.uuid()).max(5000)
})
export type DiscountScaleFields = z.infer<typeof discountScaleFieldsSchema>

export const discountScaleSchema = z.object({
	id: catalogIdSchema,
	code: airesCodeSchema,
	...discountScaleFieldsSchema.shape,
	status: recordStatusSchema,
	version: z.number().int().min(1),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime()
})
export type DiscountScale = z.infer<typeof discountScaleSchema>

/** GET /internal/discount-scales. Orden: nombre (es). */
export const listDiscountScalesQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	statuses: listParam(recordStatusSchema),
	units: listParam(discountUnitSchema),
	/** Las que se aplican a alguno de estos clientes. */
	customerIds: listParam(z.uuid())
})
export type ListDiscountScalesQuery = z.output<
	typeof listDiscountScalesQuerySchema
>

export const listDiscountScalesResponseSchema = z.object({
	discountScales: z.array(discountScaleSchema)
})

/** POST /internal/discount-scales (con `id` repetido devuelve la que hay). */
export const createDiscountScaleRequestSchema =
	discountScaleFieldsSchema.extend({ id: catalogIdSchema.optional() })

/** PUT /internal/discount-scales/:id — objeto entero. */
export const updateDiscountScaleRequestSchema =
	discountScaleFieldsSchema.extend({
		expectedVersion: z.number().int().min(1).optional()
	})

/** GET /:id · POST · PUT · POST /:id/duplicate (copia sin clientes). */
export const discountScaleResponseSchema = z.object({
	discountScale: discountScaleSchema
})

export const discountScaleEventSchema = z.object({
	discountScale: discountScaleSchema.pick({
		id: true,
		code: true,
		name: true,
		unit: true,
		status: true,
		version: true
	})
})
export const DISCOUNT_SCALE_EVENT_TYPES = [
	'catalog.discount_scale.created.v1',
	'catalog.discount_scale.updated.v1',
	'catalog.discount_scale.archived.v1',
	'catalog.discount_scale.restored.v1'
] as const
