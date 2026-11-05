import { z } from 'zod'

import { isoDateSchema } from '@henko-software/contracts-contacts'
import {
	formulaSignSchema,
	lineCodeSchema,
	lineKindSchema,
	periodSchema,
	recordStatusSchema,
	sourceKeySchema,
	statementSchema,
	statementSourceSchema
} from '@henko-software/contracts-reporting'
import { salesReportSchema } from '@henko-software/contracts-sales'

import { historyEventSchema, listParam } from './admin/common.js'

/**
 * Reportes: rubros y estado de resultados (`/admin/income-statement`,
 * armado con `reporting`), el Resumen de Administración del Inicio
 * (`GET /api/admin/summary`) y el Tablero de la red (`GET /api/board`). El
 * Resumen y el Tablero los arma el BFF con las mismas consultas (y los
 * mismos filtros del back) que las listas, así cada número coincide con la
 * lista a la que lleva su `href`. Formas de
 * `henko-web/docs/back/{income_statement,resumen-administracion,tablero}.md`.
 */

// ---------- Rubros del estado de resultados (flag `reports.incomeStatement`)

export const bffFormulaTermSchema = z.object({
	lineId: z.string(),
	sign: formulaSignSchema
})

export const bffIncomeLineSchema = z.object({
	id: z.string(),
	code: lineCodeSchema,
	name: z.string().trim().min(1).max(60),
	kind: lineKindSchema,
	parentId: z.string().nullable(),
	formula: z.array(bffFormulaTermSchema),
	percentBase: z.boolean(),
	notes: z.string().max(500).nullable(),
	status: recordStatusSchema,
	createdAt: isoDateSchema,
	/** Para `expectedVersion` al editar (el front puede ignorarlo). */
	version: z.number().int().min(1)
})
export type BffIncomeLine = z.infer<typeof bffIncomeLineSchema>

const lineFields = bffIncomeLineSchema.omit({
	id: true,
	status: true,
	createdAt: true,
	version: true
})
const subtotalsOnly = (input: z.infer<typeof lineFields>) =>
	input.kind === 'subtotal'
		? input.formula.length > 0
		: input.formula.length === 0

/** POST /api/income-statement/lines · PUT /api/income-statement/lines/:id */
export const bffIncomeLineInputSchema = lineFields
	.extend({ expectedVersion: z.number().int().min(1).optional() })
	.refine(subtotalsOnly, {
		message: 'Sólo los subtotales llevan fórmula, y al menos un rubro',
		path: ['formula']
	})
export type BffIncomeLineInput = z.infer<typeof bffIncomeLineInputSchema>

export const bffIncomeLineItemSchema = bffIncomeLineSchema.extend({
	level: z.number().int().min(1).max(3),
	childCount: z.number().int().min(0),
	usedBy: z.array(z.string()),
	/** Las fuentes asignadas a este rubro (`sales:pizzas`). */
	sources: z.array(z.string())
})

/** GET /api/income-statement/lines?query=&statuses=&kinds= */
export const listBffIncomeLinesQuerySchema = z.object({
	query: z.string().trim().max(100).optional(),
	statuses: listParam(recordStatusSchema),
	kinds: listParam(lineKindSchema)
})
export const listBffIncomeLinesResponseSchema = z.object({
	lines: z.array(bffIncomeLineItemSchema)
})

/** GET /api/income-statement/lines/:id */
export const bffIncomeLineDetailSchema = z.object({
	line: bffIncomeLineItemSchema,
	parent: bffIncomeLineSchema.nullable(),
	children: z.array(bffIncomeLineItemSchema),
	usedBy: z.array(
		z.object({ line: bffIncomeLineSchema, sign: formulaSignSchema })
	),
	history: z.array(historyEventSchema)
})

export const bffIncomeLineResponseSchema = z.object({
	line: bffIncomeLineSchema
})

/** POST /api/income-statement/lines/status — 204. */
export const bffSetLinesStatusBodySchema = z.object({
	ids: z.array(z.string()).min(1).max(200),
	status: recordStatusSchema
})

/** GET /api/income-statement/lines/suggest-code?parentId= */
export const bffSuggestCodeQuerySchema = z.object({
	parentId: z.string().optional()
})
export const bffSuggestCodeResponseSchema = z.object({
	code: lineCodeSchema.nullable()
})

/** GET /api/income-statement/periods */
export const bffPeriodsResponseSchema = z.object({
	periods: z.array(periodSchema)
})

/** GET /api/income-statement/:period */
export const bffIncomeStatementResponseSchema = z.object({
	statement: statementSchema
})

/** GET /api/income-statement/sources */
export const bffIncomeSourcesResponseSchema = z.object({
	sources: z.array(statementSourceSchema)
})
/** PUT /api/income-statement/sources/:key */
export const bffAssignSourceBodySchema = z.object({
	lineId: z.string().nullable()
})
export const bffIncomeSourceResponseSchema = z.object({
	source: statementSourceSchema
})
export { sourceKeySchema as bffSourceKeySchema }

// ---------- Resumen de Administración (Inicio, sin flag propio)

export const summaryItemSchema = z.object({
	key: z.string(),
	tone: z.enum(['danger', 'warning', 'info']),
	count: z.number().int().min(0),
	/** Centavos. */
	amount: z.number().int().optional(),
	/** El primer vencimiento. */
	date: isoDateSchema.optional(),
	/** La lista con el mismo filtro que se usó para contar. */
	href: z.string()
})
export type SummaryItem = z.infer<typeof summaryItemSchema>

export const UPCOMING_KINDS = [
	'prices',
	'payment',
	'insurance',
	'paper',
	'probation',
	'exit',
	'birthday'
] as const

export const upcomingEventSchema = z.object({
	key: z.string(),
	kind: z.enum(UPCOMING_KINDS),
	date: isoDateSchema,
	subject: z.string(),
	count: z.number().int().optional(),
	amount: z.number().int().optional(),
	href: z.string()
})
export type UpcomingEvent = z.infer<typeof upcomingEventSchema>

/**
 * De dónde sale cada parte. Si una consulta falla (módulo caído, sin
 * permiso para ese rol), esa parte sale vacía y su fuente va en
 * `unavailable`: lo demás se ve igual.
 */
export const SUMMARY_SOURCES = [
	'customers',
	'suppliers',
	'payables',
	'carriers',
	'employees',
	'prices',
	'priceLists',
	'chartOfAccounts',
	'paymentTerms',
	'bankAccounts',
	'aging',
	'statements'
] as const
export const summarySourceSchema = z.enum(SUMMARY_SOURCES)

/** GET /api/admin/summary */
export const adminSummarySchema = z.object({
	/** Día de Argentina con el que se calculó todo. */
	today: isoDateSchema,
	money: z.object({
		receivable: z.number().int(),
		receivableOverdue: z.number().int(),
		overdueCustomers: z.number().int(),
		payable: z.number().int(),
		payableOverdue: z.number().int(),
		overdueSuppliers: z.number().int(),
		/** Lo que vence de hoy al domingo (la agenda de Pagos). */
		dueThisWeek: z.number().int(),
		activeCustomers: z.number().int(),
		stoppedBuying: z.number().int()
	}),
	/** «Para resolver», sólo `count > 0`, en orden. */
	attention: z.array(summaryItemSchema),
	/** «Para ordenar» (lo que vino desprolijo de Aires), sólo `count > 0`. */
	cleanup: z.array(summaryItemSchema),
	/** «Lo que viene» (30 días), por fecha. */
	upcoming: z.array(upcomingEventSchema),
	/** Te deben: tramos de antigüedad y los que más deben (sin los a favor). */
	receivables: z.object({
		buckets: z.record(z.string(), z.number().int()),
		overdue: z.number().int(),
		top: z.array(
			z.object({
				customerId: z.string(),
				name: z.string(),
				overdue: z.number().int(),
				balance: z.number().int(),
				blocked: z.boolean()
			})
		)
	}),
	/** Cómo viene el negocio: venta neta y resultado neto de los últimos 3 meses. */
	business: z.array(
		z.object({
			period: periodSchema,
			sales: z.number().int(),
			net: z.number().int()
		})
	),
	unavailable: z.array(summarySourceSchema)
})
export type AdminSummary = z.infer<typeof adminSummarySchema>
export const adminSummaryResponseSchema = z.object({
	summary: adminSummarySchema
})

// ---------- Tablero de la red (flag `reports.dashboard`)

const pctSchema = z.number().nullable()

export const BOARD_SOURCES = [
	'sales',
	'customers',
	'aging',
	'orders',
	'returns',
	'invoices',
	'trays',
	'stock',
	'inputs'
] as const
export const boardSourceSchema = z.enum(BOARD_SOURCES)

export const storeMoveSchema = z.object({
	customerId: z.string(),
	pct: z.number(),
	units: z.number()
})

/** GET /api/board — lo que arma `useNetworkBoard`, ya sumado. */
export const boardSchema = z.object({
	today: isoDateSchema,
	/** Ventas: 12 meses contra el año anterior y 30 días contra el año pasado. */
	sales: z
		.object({
			series: salesReportSchema.shape.series,
			totals: salesReportSchema.shape.totals,
			sameStore: z.object({ pct: pctSchema, stores: z.number().int() }),
			activeStores: z.number().int()
		})
		.nullable(),
	/** Locales que piden menos que su ritmo y los que más se movieron. */
	stores: z
		.object({
			slowing: z.array(
				z.object({
					customerId: z.string(),
					days: z.number().int(),
					every: z.number().nullable()
				})
			),
			up: z.array(storeMoveSchema),
			down: z.array(storeMoveSchema),
			href: z.string()
		})
		.nullable(),
	/** Servicio: pedido entregado, faltantes, devoluciones y bandejas. */
	service: z
		.object({
			fill: pctSchema,
			fillTarget: z.number(),
			fillWeeks: z.array(pctSchema),
			missing: z.array(z.object({ articleId: z.string(), units: z.number() })),
			/** Lo facturado (facturas − notas de crédito) y lo devuelto, 30 días. */
			billed: z.number().int(),
			returned: z.number().int(),
			returnsPct: pctSchema,
			returnsTarget: z.number(),
			traysOut: z.number(),
			traysLate: z.array(
				z.object({
					customerId: z.string(),
					balance: z.number(),
					lastReturn: isoDateSchema.nullable()
				})
			),
			traysLateDays: z.number().int()
		})
		.nullable(),
	/** Stock: lo que va a faltar y cuántos artículos vencen. */
	stock: z
		.object({
			short: z.array(
				z.object({ articleId: z.string(), coverDays: z.number().nullable() })
			),
			expiringCount: z.number().int(),
			href: z.string()
		})
		.nullable(),
	/** Insumos que subieron (último precio contra el de hace 30 días). */
	inputs: z
		.object({
			risen: z.array(
				z.object({ articleId: z.string(), changePct: z.number() })
			),
			href: z.string()
		})
		.nullable(),
	/** Plata: deuda, antigüedad, concentración y días de cobro. */
	money: z
		.object({
			receivable: z.number().int(),
			overdue: z.number().int(),
			buckets: z.record(z.string(), z.number().int()),
			debtors: z.array(
				z.object({ customerId: z.string(), overdue: z.number().int() })
			),
			topShare: pctSchema,
			dso: z.number().int().nullable(),
			href: z.string()
		})
		.nullable(),
	unavailable: z.array(boardSourceSchema)
})
export type Board = z.infer<typeof boardSchema>
export const boardResponseSchema = z.object({ board: boardSchema })
