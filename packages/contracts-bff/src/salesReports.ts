import { z } from 'zod'

import { isoDateSchema } from '@henko-software/contracts-contacts'
import {
	salesGroupSchema,
	salesMatrixSchema,
	salesReportSchema,
	salesSummaryCoreSchema
} from '@henko-software/contracts-sales'

import { listParam } from './admin/common.js'

/**
 * Reportes de ventas (`/reports/sales`, `/reports/network` y el resumen de
 * Ventas del Inicio), armados con `sales`. Copian
 * `henko-web/apps/web/src/data/sales/schema.ts`; el BFF le pasa a sales el
 * rubro de cada artículo (catalog) y la zona y el vendedor de cada cliente
 * hoy (contacts).
 */

const filterParam = listParam(z.string().min(1).max(120))

/** Los cortes como filtro: `article=`, `category=`… (O adentro, Y entre ellos). */
const filtersShape = {
	article: filterParam,
	category: filterParam,
	customer: filterParam,
	zone: filterParam,
	salesperson: filterParam
}

/** GET /api/sales/report */
export const salesReportQuerySchema = z.object({
	from: isoDateSchema,
	to: isoDateSchema,
	compareFrom: isoDateSchema,
	compareTo: isoDateSchema,
	groupBy: salesGroupSchema,
	...filtersShape
})
export type SalesReportQuery = z.output<typeof salesReportQuerySchema>
export const salesReportBffResponseSchema = z.object({
	report: salesReportSchema
})

/** GET /api/sales/matrix */
export const salesMatrixQuerySchema = z.object({
	from: isoDateSchema,
	to: isoDateSchema,
	groupBy: salesGroupSchema,
	...filtersShape
})
export type SalesMatrixQuery = z.output<typeof salesMatrixQuerySchema>
export const salesMatrixBffResponseSchema = z.object({
	matrix: salesMatrixSchema
})

/** GET /api/sales/summary: `SalesSummary` de `docs/back/resumen-ventas.md`. */
export const salesSummarySchema = salesSummaryCoreSchema
	.omit({ now: true, nextTotal: true })
	.extend({
		next: z.object({
			/** Locales que reparten ese día. */
			expected: z.number().int(),
			ordered: z.number().int(),
			missing: z.number().int(),
			/** Los que faltan y todavía llegan a pedir. */
			open: z.number().int(),
			/** Lo pedido, con IVA, centavos. */
			total: z.number().int(),
			/** El cierre más próximo de una zona con faltantes. */
			cutoff: z.string().nullable()
		})
	})
export type SalesSummary = z.infer<typeof salesSummarySchema>
export const salesSummaryBffResponseSchema = z.object({
	summary: salesSummarySchema
})
