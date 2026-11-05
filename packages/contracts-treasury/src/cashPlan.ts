import { z } from 'zod'

import { centsSchema, isoDateSchema, treasuryIdSchema } from './common.js'

/**
 * Caja proyectada (Aires: Tesorería › Cash flow). Lo cargado a mano es de
 * treasury; la proyección junta eso con lo de treasury (saldos, cheques en
 * cartera, e-cheq propios) y lo que trae quien llama de `ledger` (lo que se
 * espera cobrar y lo que hay que pagar). Reglas de
 * `henko-web/apps/web/src/data/cash_plan/rules.ts`.
 */

export const cashEntrySchema = z.object({
	id: treasuryIdSchema,
	date: isoDateSchema,
	label: z.string().trim().min(1).max(80),
	amount: centsSchema.refine(value => value !== 0, {
		message: 'Falta el monto.'
	})
})
export type CashEntry = z.infer<typeof cashEntrySchema>
export const cashEntryInputSchema = cashEntrySchema.omit({ id: true })
/** `POST /internal/cash-plan/entries` (con `id` repetido, 200 con el que hay). */
export const createCashEntryRequestSchema = cashEntryInputSchema.extend({
	id: treasuryIdSchema.optional()
})
export const cashEntryResponseSchema = z.object({ entry: cashEntrySchema })
export const listCashEntriesResponseSchema = z.object({
	entries: z.array(cashEntrySchema)
})

export const FLOW_SOURCES = [
	'collection',
	'cheque',
	'payable',
	'echeq',
	'manual'
] as const
export const cashFlowSchema = z.object({
	date: isoDateSchema,
	amount: centsSchema,
	source: z.enum(FLOW_SOURCES),
	label: z.string().max(200)
})
export type CashFlow = z.infer<typeof cashFlowSchema>

export const planDaySchema = z.object({
	date: isoDateSchema,
	inflow: z.number().int().min(0),
	outflow: z.number().int().min(0),
	balance: centsSchema
})

/**
 * `POST /internal/cash-plan/projection`. `collections`: lo que queda de cada
 * factura después de los créditos sin imputar (ledger, `net=true`) con cuánto
 * se atrasa ese cliente; `payables`: lo que falta pagar a proveedores
 * (ledger, sin `net`). Los nombres los pone quien llama.
 */
export const projectionRequestSchema = z.object({
	today: isoDateSchema.optional(),
	days: z.number().int().min(1).max(120).default(30),
	minimum: centsSchema.default(0),
	collections: z
		.array(
			z.object({
				label: z.string().max(200),
				dueDate: isoDateSchema.nullable(),
				avgDaysLate: z.number().int().min(0).nullable(),
				pending: z.number().int().positive()
			})
		)
		.max(20_000),
	payables: z
		.array(
			z.object({
				label: z.string().max(200),
				dueDate: isoDateSchema.nullable(),
				date: isoDateSchema,
				pending: z.number().int().positive()
			})
		)
		.max(20_000),
	/** Nombres de los clientes y proveedores de los cheques y e-cheq, por id. */
	names: z.record(z.string(), z.string().max(200)).default({})
})
export type ProjectionRequest = z.output<typeof projectionRequestSchema>

export const projectionResponseSchema = z.object({
	today: isoDateSchema,
	/** Lo de hoy en las cuentas en pesos activas. */
	start: centsSchema,
	/** Según cómo paga cada cliente (la que manda). */
	habitDays: z.array(planDaySchema),
	/** Si todos pagaran al vencimiento. */
	dueDays: z.array(planDaySchema),
	lowest: planDaySchema.nullable(),
	firstBelow: planDaySchema.nullable(),
	/** Lo que no se cuenta por ir más atrasado que de costumbre. */
	late: z.number().int().min(0),
	/** Lo que más la mueve. */
	moves: z.array(cashFlowSchema)
})
export type Projection = z.infer<typeof projectionResponseSchema>
