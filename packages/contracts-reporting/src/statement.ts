import { z } from 'zod'

import { periodSchema, reportingIdSchema } from './common.js'

/**
 * El estado de resultados de un mes y de dónde sale cada importe.
 *
 * Los rubros comunes reciben lo de sus **fuentes**: lo facturado sin IVA de
 * un rubro de artículo (`sales:<rubro>`, facturas menos notas de crédito
 * de Ventas) o lo comprado sin IVA (`purchases:<rubro>`, facturas de Compras
 * menos sus notas de crédito y anulaciones). Una fuente sin rubro asignado
 * va al rubro por defecto de su tipo (config del servicio). Lo devengado:
 * la fecha del comprobante decide el mes.
 */

export const SOURCE_KINDS = ['sales', 'purchases'] as const
export const sourceKindSchema = z.enum(SOURCE_KINDS)
export type SourceKind = z.infer<typeof sourceKindSchema>

/**
 * `sales:pizzas`, `purchases:lacteos`. `sales:_none` es lo facturado de
 * artículos sin rubro; `purchases:_concept`, lo comprado sin artículos
 * (fletes, servicios: sólo el concepto).
 */
export const sourceKeySchema = z
	.string()
	.max(80)
	.regex(/^(sales|purchases):\S.*$/)
export type SourceKey = z.infer<typeof sourceKeySchema>

export const NO_CATEGORY = '_none'
export const CONCEPT_ONLY = '_concept'

export const statementSourceSchema = z.object({
	key: sourceKeySchema,
	kind: sourceKindSchema,
	/** El rubro de artículo (catalog); `null` en `_none` y `_concept`. */
	category: z.string().nullable(),
	/** El rubro del estado de resultados asignado; `null` = el por defecto. */
	lineId: reportingIdSchema.nullable(),
	/** Adonde va de verdad (lo asignado o el por defecto, si está activo). */
	effectiveLineId: reportingIdSchema.nullable(),
	/** El último mes con importes de esta fuente. */
	lastPeriod: periodSchema.nullable()
})
export type StatementSource = z.infer<typeof statementSourceSchema>

/** GET /internal/income-statement/sources — orden: tipo, clave. */
export const listStatementSourcesResponseSchema = z.object({
	sources: z.array(statementSourceSchema)
})

/**
 * PUT /internal/income-statement/sources/:key — a qué rubro común va.
 * `null` = al por defecto. Una fuente que todavía no tuvo importes se puede
 * asignar igual (queda lista para cuando llegue).
 */
export const assignSourceRequestSchema = z.object({
	lineId: reportingIdSchema.nullable()
})
export const statementSourceResponseSchema = z.object({
	source: statementSourceSchema
})

/** GET /internal/income-statement/periods — del más nuevo al más viejo. */
export const listPeriodsResponseSchema = z.object({
	periods: z.array(periodSchema)
})

export const statementRowSchema = z.object({
	lineId: reportingIdSchema,
	/** En centavos, con signo. */
	amount: z.number().int(),
	/** Sobre el rubro base; `null` si no hay base o da cero. */
	percent: z.number().nullable()
})

/** GET /internal/income-statement/statements/:period */
export const statementSchema = z.object({
	period: periodSchema,
	/** El rubro base de los porcentajes; `null` si no hay ninguno marcado. */
	baseLineId: reportingIdSchema.nullable(),
	/** Un renglón por rubro activo, en el orden del código. */
	rows: z.array(statementRowSchema),
	/**
	 * Lo que no entró en ningún rubro (la fuente no tiene rubro y el por
	 * defecto no existe o está dado de baja): para que no se pierda de vista.
	 */
	unassigned: z.array(
		z.object({ source: sourceKeySchema, amount: z.number().int() })
	)
})
export type Statement = z.infer<typeof statementSchema>
export const statementResponseSchema = z.object({ statement: statementSchema })
