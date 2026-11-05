import { z } from 'zod'

import {
	centsSchema,
	idsSchema,
	isoDateSchema,
	listParam,
	treasuryIdSchema
} from './common.js'

/**
 * Extractos del banco y conciliación (Aires: cuenta corriente bancaria y
 * «Conciliar»). Forma de
 * `henko-web/apps/web/src/data/bank_statements/schema.ts`. Las sugerencias
 * (`suggestFor`) las calcula treasury; la de «parece de este cliente» (por
 * el CUIT del detalle) la suma el BFF con contacts.
 */

export const STATEMENT_STATUSES = ['pending', 'matched', 'ignored'] as const
export const statementStatusSchema = z.enum(STATEMENT_STATUSES)

export const MATCH_KINDS = [
	'receipt',
	'payment_order',
	'cheque',
	'expense'
] as const
export const statementMatchSchema = z.object({
	kind: z.enum(MATCH_KINDS),
	refId: treasuryIdSchema.nullable(),
	label: z.string().max(200)
})
export type StatementMatch = z.infer<typeof statementMatchSchema>

export const statementLineSchema = z.object({
	id: treasuryIdSchema,
	accountId: treasuryIdSchema,
	date: isoDateSchema,
	description: z.string().max(200),
	amount: centsSchema,
	cuit: z.string().nullable(),
	status: statementStatusSchema,
	match: statementMatchSchema.nullable(),
	/** Cuándo se concilió o se ignoró. */
	reviewedAt: isoDateSchema.nullable()
})
export type StatementLine = z.infer<typeof statementLineSchema>

/** `GET /internal/bank-accounts/:id/statement?statuses=` — del más nuevo al más viejo. */
export const listStatementQuerySchema = z.object({
	statuses: listParam(statementStatusSchema)
})
export const listStatementResponseSchema = z.object({
	lines: z.array(statementLineSchema)
})

/** Qué propone treasury: coincide con algo cargado o lo dice el detalle del banco. */
export const suggestionSchema = z.object({
	confidence: z.enum(['match', 'rule']),
	match: statementMatchSchema
})
export type Suggestion = z.infer<typeof suggestionSchema>
/** `GET /internal/bank-accounts/:id/statement/suggestions` — por id de movimiento. */
export const suggestionsResponseSchema = z.object({
	suggestions: z.record(z.string(), suggestionSchema)
})

/** Una fila del archivo del banco. */
export const statementRowSchema = z.object({
	date: isoDateSchema,
	description: z.string().trim().max(200),
	amount: centsSchema.refine(value => value !== 0, {
		message: 'No puede ser cero'
	})
})
/** `POST /internal/bank-accounts/:id/statement` — lo repetido (fecha, monto y detalle) no entra. */
export const importStatementRequestSchema = z.object({
	rows: z.array(statementRowSchema).min(1).max(5000)
})
export const importStatementResponseSchema = z.object({
	added: z.number().int().min(0),
	duplicates: z.number().int().min(0)
})

/** `POST /internal/bank-statements/confirm` — todo o nada. Un cheque queda acreditado. */
export const confirmStatementRequestSchema = z.object({
	items: z
		.array(
			z.object({
				lineId: treasuryIdSchema,
				match: statementMatchSchema
			})
		)
		.min(1)
		.max(500),
	date: isoDateSchema.optional()
})
/** `POST /internal/bank-statements/ignore` */
export const ignoreStatementRequestSchema = z.object({ ids: idsSchema })

/**
 * `GET /internal/bank-statements/unreceipted` — lo que entró a una cuenta en
 * pesos, por revisar y sin coincidencia con nada cargado («En el banco, sin
 * recibo»).
 */
export const unreceiptedResponseSchema = z.object({
	lines: z.array(statementLineSchema)
})
