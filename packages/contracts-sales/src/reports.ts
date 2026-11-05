import { z } from 'zod'

import { isoDateSchema } from './common.js'

/**
 * Reportes de ventas (`henko-web/docs/back/sales.md` y
 * `resumen-ventas.md`): lo vendido sumado en la base, sin mandar líneas.
 * Sale de las facturas autorizadas (CAE o CAEA) menos sus notas de crédito;
 * las de débito no son venta. Plata en centavos, sin IVA, con la
 * bonificación. Sales no llama a otros módulos: lo que hace falta del
 * catálogo (rubro, si se cuenta por unidad) y del cliente hoy (zona,
 * vendedor) lo trae quien llama.
 */

export const SALES_GROUPS = [
	'article',
	'category',
	'customer',
	'zone',
	'salesperson'
] as const
export const salesGroupSchema = z.enum(SALES_GROUPS)
export type SalesGroup = z.infer<typeof salesGroupSchema>

/** Lo que va en una fila cuando no hay dato (sin rubro, sin zona, sin vendedor). */
export const NO_GROUP_KEY = '—'

export const dateRangeSchema = z
	.object({ from: isoDateSchema, to: isoDateSchema })
	.refine(range => range.from <= range.to, {
		message: 'from no puede ser posterior a to',
		path: ['to']
	})
export type DateRange = z.infer<typeof dateRangeSchema>

/** Sólo lo de esos valores (un producto, un local): Y entre cortes, O adentro. */
const filterValues = z.array(z.string().min(1).max(120)).max(500).optional()
export const salesFiltersSchema = z.object({
	article: filterValues,
	category: filterValues,
	customer: filterValues,
	zone: filterValues,
	salesperson: filterValues
})
export type SalesFilters = z.infer<typeof salesFiltersSchema>

/** Del catálogo: el rubro del artículo y si se cuenta por unidad. */
export const reportArticleSchema = z.object({
	id: z.string().min(1).max(60),
	category: z.string().max(120).nullable(),
	/** Pizzas, empanadas, latas: sí. Kilos: no (no se suman con las unidades). */
	counted: z.boolean()
})

/** Del cliente hoy: su zona y su vendedor. Si falta, los de la factura. */
export const reportCustomerSchema = z.object({
	id: z.uuid(),
	zone: z.string().max(120).nullable(),
	salespersonId: z.string().max(60).nullable()
})

const lookupsShape = {
	articles: z.array(reportArticleSchema).max(20_000).default([]),
	customers: z.array(reportCustomerSchema).max(20_000).default([])
}

export const salesFiguresSchema = z.object({
	/** Sólo lo que se cuenta por unidad (en una fila de producto, las suyas). */
	units: z.number(),
	net: z.number().int()
})
export type SalesFigures = z.infer<typeof salesFiguresSchema>

/** POST /internal/reports/sales */
export const salesReportRequestSchema = z.object({
	current: dateRangeSchema,
	previous: dateRangeSchema,
	groupBy: salesGroupSchema,
	filters: salesFiltersSchema.default({}),
	...lookupsShape
})
export type SalesReportRequest = z.input<typeof salesReportRequestSchema>

export const salesReportSchema = z.object({
	bucket: z.enum(['day', 'month']),
	totals: z.object({
		current: salesFiguresSchema.extend({ customers: z.number().int() }),
		previous: salesFiguresSchema.extend({ customers: z.number().int() })
	}),
	/** Un día o un mes del gráfico, con el que le corresponde en la comparación. */
	series: z.array(
		z.object({
			key: z.string(),
			previousKey: z.string(),
			current: salesFiguresSchema,
			previous: salesFiguresSchema
		})
	),
	rows: z.array(
		z.object({
			key: z.string(),
			current: salesFiguresSchema,
			previous: salesFiguresSchema
		})
	),
	/** Desde cuándo hay datos (lo anterior no se puede comparar). */
	since: isoDateSchema
})
export type SalesReport = z.infer<typeof salesReportSchema>
export const salesReportResponseSchema = z.object({ report: salesReportSchema })

/** POST /internal/reports/sales-matrix */
export const salesMatrixRequestSchema = z.object({
	range: dateRangeSchema,
	groupBy: salesGroupSchema,
	filters: salesFiltersSchema.default({}),
	...lookupsShape
})
export type SalesMatrixRequest = z.input<typeof salesMatrixRequestSchema>

export const salesMatrixSchema = z.object({
	/** Los meses, en orden: «2025-11». */
	months: z.array(z.string().regex(/^\d{4}-\d{2}$/)),
	rows: z.array(
		z.object({ key: z.string(), months: z.array(salesFiguresSchema) })
	)
})
export type SalesMatrix = z.infer<typeof salesMatrixSchema>
export const salesMatrixResponseSchema = z.object({ matrix: salesMatrixSchema })

export const RETURN_SUMMARY_REASONS = [
	'shortage',
	'breakage',
	'cold_chain',
	'expired',
	'order_error'
] as const

/**
 * GET /internal/reports/summary — la portada de Ventas con lo que sales
 * sabe solo. Quién falta pedir para la próxima entrega (`expected`,
 * `ordered`, `missing`, `open`, `cutoff`) necesita los clientes de
 * contacts: lo completa el BFF con el tablero de esa fecha.
 */
export const salesSummaryCoreSchema = z.object({
	/** Día de Argentina con el que se calculó todo. */
	today: isoDateSchema,
	/** «2026-11-05T10:15» en Argentina, para comparar con los cierres. */
	now: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
	/** La primera entrega en la que alguna zona todavía recibe pedidos. */
	nextDate: isoDateSchema,
	/** Lo pedido para esa entrega, con IVA, centavos. */
	nextTotal: z.number().int(),
	/** Pedidos con entrega hoy, por etapa. */
	day: z.object({
		held: z.number().int(),
		toDispatch: z.number().int(),
		dispatched: z.number().int(),
		invoiced: z.number().int()
	}),
	held: z.object({ count: z.number().int(), total: z.number().int() }),
	toInvoice: z.object({ count: z.number().int(), total: z.number().int() }),
	invoiced: z.object({
		/** Facturas y notas de débito menos notas de crédito, con IVA, centavos. */
		month: z.number().int(),
		count: z.number().int(),
		/** El mes pasado hasta el mismo día. */
		previous: z.number().int(),
		delta: z.number().nullable(),
		byDay: z.array(
			z.object({
				date: isoDateSchema,
				amount: z.number().int(),
				count: z.number().int()
			})
		),
		/** Facturas del mes sin mail ni WhatsApp. */
		unsent: z.number().int()
	}),
	trays: z.object({
		owed: z.number().int(),
		pendingRoutes: z.number().int(),
		overdueStores: z.number().int()
	}),
	returns: z.object({
		count: z.number().int(),
		total: z.number().int(),
		byReason: z.array(
			z.object({
				reason: z.enum(RETURN_SUMMARY_REASONS),
				count: z.number().int()
			})
		)
	})
})
export type SalesSummaryCore = z.infer<typeof salesSummaryCoreSchema>
export const salesSummaryCoreResponseSchema = z.object({
	summary: salesSummaryCoreSchema
})
