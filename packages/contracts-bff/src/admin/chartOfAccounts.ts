import { z } from 'zod'

import {
	isoDateSchema,
	recordStatusSchema
} from '@henko-software/contracts-contacts'

import {
	booleanParam,
	historyEventSchema,
	listParam,
	recordIdSchema,
	statusesParam
} from './common.js'

/**
 * Plan de cuentas (`/admin/chart-of-accounts`), armado con `ledger`. Las
 * formas copian `henko-web/apps/web/src/data/chart_of_accounts/schema.ts`.
 * Errores que el front reconoce: `ledger.code_taken` (H-PC002),
 * `ledger.move_loop` (H-PC003), `ledger.has_active_children` (H-PC004),
 * `ledger.system_account` (H-PC005), `ledger.move_into_posting` (H-PC006) y
 * `ledger.chart_account_not_found` (H-NOTFOUND).
 */

export const CHART_ACCOUNT_KINDS = ['title', 'posting', 'cash'] as const
export const CHART_ACCOUNT_USES = [
	'purchases',
	'sales',
	'collections',
	'payments'
] as const
export const chartAccountCodeSchema = z.string().regex(/^\d-\d-\d{2}-\d-\d{3}$/)

export const bffChartAccountSchema = z.object({
	id: recordIdSchema,
	code: chartAccountCodeSchema,
	name: z.string().trim().min(1).max(80),
	kind: z.enum(CHART_ACCOUNT_KINDS),
	parentId: recordIdSchema.nullable(),
	isResult: z.boolean(),
	systemManaged: z.boolean(),
	uses: z.array(z.enum(CHART_ACCOUNT_USES)),
	notes: z.string().max(500).nullable(),
	status: recordStatusSchema,
	createdAt: isoDateSchema
})
export type BffChartAccount = z.infer<typeof bffChartAccountSchema>

/** POST · PUT — sin `id`, `status` ni `createdAt`. Un título no lleva usos. */
export const chartAccountInputSchema = bffChartAccountSchema
	.omit({ id: true, status: true, createdAt: true })
	.refine(input => input.kind !== 'title' || input.uses.length === 0, {
		message: 'Un título no se usa en comprobantes',
		path: ['uses']
	})
export type ChartAccountInput = z.infer<typeof chartAccountInputSchema>

export const bffChartAccountListItemSchema = bffChartAccountSchema.extend({
	level: z.number().int().min(1).max(6),
	issues: z.array(z.enum(['orphan', 'code_mismatch'])),
	childCount: z.number().int().min(0)
})

/** GET /api/chart-of-accounts — por código. Y entre filtros, O dentro. */
export const listBffChartAccountsQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	statuses: statusesParam,
	kinds: listParam(z.enum(CHART_ACCOUNT_KINDS)),
	uses: listParam(z.enum(CHART_ACCOUNT_USES)),
	results: listParam(booleanParam),
	withIssues: booleanParam.optional()
})
export const listChartAccountsBffResponseSchema = z.object({
	accounts: z.array(bffChartAccountListItemSchema)
})

/** GET /api/chart-of-accounts/:id — la ficha, con historial armado por el BFF. */
export const chartAccountDetailBffResponseSchema = z.object({
	account: bffChartAccountListItemSchema,
	path: z.array(bffChartAccountSchema),
	children: z.array(bffChartAccountListItemSchema),
	postingDescendants: z.number().int().min(0),
	expectedParent: bffChartAccountSchema.nullable(),
	history: z.array(historyEventSchema)
})

/** POST · PUT /api/chart-of-accounts · GET /by-code/:code (`account` puede ser `null`). */
export const chartAccountBffResponseSchema = z.object({
	account: bffChartAccountSchema
})
export const chartAccountByCodeBffResponseSchema = z.object({
	account: bffChartAccountSchema.nullable()
})

/** GET /api/chart-of-accounts/suggest-code?parentId=&accountId= */
export const suggestChartCodeBffQuerySchema = z.object({
	parentId: z.uuid().optional(),
	accountId: z.uuid().optional()
})
export const suggestChartCodeBffResponseSchema = z.object({
	code: chartAccountCodeSchema.nullable()
})

/** POST /api/chart-of-accounts/:id/move — deshacer = mover a `previous`. */
export const moveChartAccountBodySchema = z.object({
	parentId: z.uuid().nullable(),
	code: chartAccountCodeSchema
})
export const moveChartAccountBffResponseSchema = z.object({
	account: bffChartAccountSchema,
	previous: z.object({
		parentId: recordIdSchema.nullable(),
		code: chartAccountCodeSchema
	}),
	recoded: z.number().int().min(0)
})
