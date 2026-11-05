import { z } from 'zod'

import {
	historyEntrySchema,
	isoDateSchema,
	recordStatusSchema
} from '@henko-software/contracts-contacts'

import { booleanParam, listParam } from './common.js'

/**
 * Plan de cuentas (Aires: Administración › Plan de Cuentas). Copia
 * `henko-web/apps/web/src/data/chart_of_accounts/schema.ts`; las reglas del
 * código (nivel, cuenta de arriba, código sugerido, recodificar al mover)
 * son las de `codes.ts` del front.
 */

/** Título (agrupa), Común (imputable) o Caja (imputable con efectivo). */
export const ACCOUNT_KINDS = ['title', 'posting', 'cash'] as const
export const accountKindSchema = z.enum(ACCOUNT_KINDS)
export type AccountKind = z.infer<typeof accountKindSchema>

/** «Apto Compras / Ventas / Cobranza / Pagos». */
export const ACCOUNT_USES = [
	'purchases',
	'sales',
	'collections',
	'payments'
] as const
export const accountUseSchema = z.enum(ACCOUNT_USES)
export type AccountUse = z.infer<typeof accountUseSchema>

/** N-N-NN-N-NNN (1-1-12-1-004). Seis niveles. */
export const accountCodeSchema = z.string().regex(/^\d-\d-\d{2}-\d-\d{3}$/)

export const ACCOUNT_ISSUES = ['orphan', 'code_mismatch'] as const
export const accountIssueSchema = z.enum(ACCOUNT_ISSUES)
export type AccountIssue = z.infer<typeof accountIssueSchema>

export const chartAccountSchema = z.object({
	id: z.uuid(),
	code: accountCodeSchema,
	name: z.string().trim().min(1).max(80),
	kind: accountKindSchema,
	/** «Sumariza en». `null` = en la raíz. */
	parentId: z.uuid().nullable(),
	isResult: z.boolean(),
	systemManaged: z.boolean(),
	uses: z.array(accountUseSchema),
	notes: z.string().max(500).nullable(),
	status: recordStatusSchema,
	createdAt: isoDateSchema,
	version: z.number().int().min(1)
})
export type ChartAccount = z.infer<typeof chartAccountSchema>

export const chartAccountListItemSchema = chartAccountSchema.extend({
	level: z.number().int().min(1).max(6),
	issues: z.array(accountIssueSchema),
	childCount: z.number().int().min(0)
})
export type ChartAccountListItem = z.infer<typeof chartAccountListItemSchema>

const accountFields = z.object({
	code: accountCodeSchema,
	name: z.string().trim().min(1).max(80),
	kind: accountKindSchema,
	parentId: z.uuid().nullable(),
	isResult: z.boolean(),
	systemManaged: z.boolean(),
	uses: z.array(accountUseSchema).max(4),
	notes: z.string().max(500).nullable()
})

const titleWithoutUses = <T extends { kind: AccountKind; uses: AccountUse[] }>(
	input: T,
	context: z.RefinementCtx
) => {
	if (input.kind === 'title' && input.uses.length > 0)
		context.addIssue({
			code: 'custom',
			message: 'Un título no se usa en comprobantes',
			path: ['uses']
		})
}

/** POST /internal/chart-of-accounts. Con un `id` que ya existe, 200 con la que hay. */
export const createChartAccountRequestSchema = accountFields
	.extend({ id: z.uuid().optional() })
	.superRefine(titleWithoutUses)
export type CreateChartAccountRequest = z.infer<
	typeof createChartAccountRequestSchema
>

/**
 * PUT /internal/chart-of-accounts/:id — edita los datos. `code` y
 * `parentId` se ignoran: el lugar cambia sólo con `move`.
 */
export const updateChartAccountRequestSchema = accountFields
	.extend({ expectedVersion: z.number().int().min(1).optional() })
	.superRefine(titleWithoutUses)
export type UpdateChartAccountRequest = z.infer<
	typeof updateChartAccountRequestSchema
>

/** GET /internal/chart-of-accounts — por código. Y entre filtros, O dentro. */
export const listChartAccountsQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	statuses: listParam(recordStatusSchema),
	kinds: listParam(accountKindSchema),
	uses: listParam(accountUseSchema),
	results: listParam(booleanParam),
	withIssues: booleanParam.optional()
})
export type ListChartAccountsQuery = z.output<
	typeof listChartAccountsQuerySchema
>
export const listChartAccountsResponseSchema = z.object({
	accounts: z.array(chartAccountListItemSchema)
})

/** GET /internal/chart-of-accounts/:id */
export const chartAccountDetailResponseSchema = z.object({
	account: chartAccountListItemSchema,
	path: z.array(chartAccountSchema),
	children: z.array(chartAccountListItemSchema),
	postingDescendants: z.number().int().min(0),
	expectedParent: chartAccountSchema.nullable(),
	/** Auditoría, de lo más nuevo a lo más viejo (el nombre lo pone el BFF). */
	history: z.array(historyEntrySchema)
})

export const chartAccountResponseSchema = z.object({
	account: chartAccountSchema
})

/** GET /internal/chart-of-accounts/by-code/:code */
export const chartAccountByCodeResponseSchema = z.object({
	account: chartAccountSchema.nullable()
})

/** GET /internal/chart-of-accounts/suggest-code?parentId=&accountId= */
export const suggestCodeQuerySchema = z.object({
	parentId: z.uuid().optional(),
	accountId: z.uuid().optional()
})
export const suggestCodeResponseSchema = z.object({
	code: accountCodeSchema.nullable()
})

/** POST /internal/chart-of-accounts/:id/move */
export const moveChartAccountRequestSchema = z.object({
	parentId: z.uuid().nullable(),
	code: accountCodeSchema
})
export const moveChartAccountResponseSchema = z.object({
	account: chartAccountSchema,
	previous: z.object({
		parentId: z.uuid().nullable(),
		code: accountCodeSchema
	}),
	recoded: z.number().int().min(0)
})

/** POST /internal/chart-of-accounts/status — todo o nada. 204. */
export const setChartAccountsStatusRequestSchema = z.object({
	ids: z.array(z.uuid()).min(1).max(500),
	status: recordStatusSchema
})
