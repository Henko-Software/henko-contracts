import { z } from 'zod'

import { listParam } from '@henko-software/contracts-common'

import {
	historyEntrySchema,
	isoDateSchema,
	recordStatusSchema,
	reportingIdSchema
} from './common.js'

/**
 * Rubros del estado de resultados de gestión (Aires: Administración ›
 * Rubros EERR). Copia `henko-web/docs/back/income_statement.md`.
 */

/**
 * - `title`: agrupa; su importe es la suma de sus rubros.
 * - `common`: recibe importes (de las fuentes que tiene asignadas).
 * - `subtotal`: se calcula con su fórmula (Utilidad bruta = Venta neta −
 *   Costo variable). En Aires eran títulos vacíos.
 */
export const LINE_KINDS = ['title', 'common', 'subtotal'] as const
export const lineKindSchema = z.enum(LINE_KINDS)
export type LineKind = z.infer<typeof lineKindSchema>

/** Código del rubro: 10-00 (nivel 1), 11-00 (nivel 2), 41-02 (nivel 3). */
export const lineCodeSchema = z.string().regex(/^\d{2}-\d{2}$/)

export const FORMULA_SIGNS = ['add', 'subtract'] as const
export const formulaSignSchema = z.enum(FORMULA_SIGNS)
export type FormulaSign = z.infer<typeof formulaSignSchema>

export const formulaTermSchema = z.object({
	lineId: reportingIdSchema,
	sign: formulaSignSchema
})
export type FormulaTerm = z.infer<typeof formulaTermSchema>

export const statementLineSchema = z.object({
	id: reportingIdSchema,
	code: lineCodeSchema,
	name: z.string().trim().min(1).max(60),
	kind: lineKindSchema,
	/** «Sumariza en». `null` = en la raíz. */
	parentId: reportingIdSchema.nullable(),
	/** Sólo en los subtotales, con al menos un término. Los demás, `[]`. */
	formula: z.array(formulaTermSchema).max(40),
	/** Base de los porcentajes del reporte (la venta neta). Sólo uno. */
	percentBase: z.boolean(),
	notes: z.string().max(500).nullable(),
	status: recordStatusSchema,
	/** Lo pone el sistema. */
	createdAt: isoDateSchema,
	version: z.number().int().min(1)
})
export type StatementLine = z.infer<typeof statementLineSchema>

const lineFields = statementLineSchema.omit({
	id: true,
	status: true,
	createdAt: true,
	version: true
})

const onlySubtotalsHaveFormula = (input: z.infer<typeof lineFields>) =>
	input.kind === 'subtotal'
		? input.formula.length > 0
		: input.formula.length === 0

/** POST /internal/income-statement/lines */
export const statementLineInputSchema = lineFields.refine(
	onlySubtotalsHaveFormula,
	{
		message: 'Sólo los subtotales llevan fórmula, y al menos un rubro',
		path: ['formula']
	}
)
export type StatementLineInput = z.infer<typeof statementLineInputSchema>

/** PUT /internal/income-statement/lines/:id — objeto entero. */
export const updateStatementLineRequestSchema = lineFields
	.extend({ expectedVersion: z.number().int().min(1).optional() })
	.refine(onlySubtotalsHaveFormula, {
		message: 'Sólo los subtotales llevan fórmula, y al menos un rubro',
		path: ['formula']
	})
export type UpdateStatementLineRequest = z.infer<
	typeof updateStatementLineRequestSchema
>

/** Un rubro en el listado, con lo que se calcula del árbol. */
export const statementLineItemSchema = statementLineSchema.extend({
	/** 1 (10-00), 2 (11-00) o 3 (41-02). Sale del código. */
	level: z.number().int().min(1).max(3),
	childCount: z.number().int().min(0),
	/** Subtotales activos que lo usan en su fórmula. */
	usedBy: z.array(reportingIdSchema),
	/** Fuentes asignadas (sólo los comunes): `sales:pizzas`. */
	sources: z.array(z.string())
})
export type StatementLineItem = z.infer<typeof statementLineItemSchema>

/** GET /internal/income-statement/lines?query=&statuses=&kinds= */
export const listStatementLinesQuerySchema = z.object({
	/** Código, nombre o comentarios. */
	query: z.string().trim().max(100).optional(),
	statuses: listParam(recordStatusSchema),
	kinds: listParam(lineKindSchema)
})
export type ListStatementLinesQuery = z.infer<
	typeof listStatementLinesQuerySchema
>
export const listStatementLinesResponseSchema = z.object({
	lines: z.array(statementLineItemSchema)
})

/** GET /internal/income-statement/lines/:id */
export const statementLineDetailSchema = z.object({
	line: statementLineItemSchema,
	parent: statementLineSchema.nullable(),
	children: z.array(statementLineItemSchema),
	usedBy: z.array(
		z.object({ line: statementLineSchema, sign: formulaSignSchema })
	),
	history: z.array(historyEntrySchema)
})
export type StatementLineDetail = z.infer<typeof statementLineDetailSchema>

/** POST · PUT: el rubro como quedó. */
export const statementLineResponseSchema = z.object({
	line: statementLineSchema
})

/**
 * POST /internal/income-statement/lines/status — baja o recuperación,
 * todo o nada. Deshacer = la inversa.
 */
export const setLinesStatusRequestSchema = z.object({
	ids: z.array(reportingIdSchema).min(1).max(200),
	status: recordStatusSchema
})
export type SetLinesStatusRequest = z.infer<typeof setLinesStatusRequestSchema>

/** GET /internal/income-statement/lines/suggest-code?parentId= */
export const suggestCodeQuerySchema = z.object({
	parentId: reportingIdSchema.optional()
})
/** `null` si no queda lugar. */
export const suggestCodeResponseSchema = z.object({
	code: lineCodeSchema.nullable()
})
