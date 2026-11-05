import { z } from 'zod'

import {
	booleanParam,
	centsSchema,
	currencySchema,
	isoDateSchema,
	listParam,
	treasuryIdSchema
} from './common.js'

/**
 * Cuentas bancarias de la casa central (Aires: Administración › Cuentas
 * Bancarias): bancos, billeteras y financieras, con sus tres cuentas
 * contables. Forma de `henko-web/apps/web/src/data/bank_accounts/schema.ts`.
 */

const BLOCK_1 = [7, 1, 3, 9, 7, 1, 3]
const BLOCK_2 = [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3]
const checkDigit = (digits: string, weights: number[]) =>
	(10 -
		(weights.reduce(
			(total, weight, index) => total + weight * Number(digits[index] ?? 0),
			0
		) %
			10)) %
	10

/** CBU o CVU: 22 números y los dos verificadores del BCRA. */
export const isValidCbu = (value: string) =>
	/^\d{22}$/.test(value) &&
	checkDigit(value.slice(0, 7), BLOCK_1) === Number(value[7]) &&
	checkDigit(value.slice(8, 21), BLOCK_2) === Number(value[21])

export const cbuSchema = z
	.string()
	.regex(/^\d{22}$/)
	.refine(isValidCbu, { message: 'El CBU no es válido.' })

/**
 * La razón social de la casa central (Aires: «Empresa»). Texto opaco: la
 * lista es de cada instancia (decisión asumida 7).
 */
export const companyIdSchema = z.string().trim().min(1).max(40)

export const ENTITY_TYPES = ['bank', 'wallet', 'financial'] as const
export const entityTypeSchema = z.enum(ENTITY_TYPES)
export type EntityType = z.infer<typeof entityTypeSchema>

export const ACCOUNT_TYPES = ['checking', 'savings', 'payment'] as const
export const accountTypeSchema = z.enum(ACCOUNT_TYPES)

export const RECORD_STATUSES = ['active', 'deleted'] as const
export const recordStatusSchema = z.enum(RECORD_STATUSES)
export type RecordStatus = z.infer<typeof recordStatusSchema>

/** Cuenta del plan de cuentas, como en Aires: 1-1-12-1-004. */
export const ledgerCodeSchema = z.string().regex(/^\d-\d-\d{2}-\d-\d{3}$/)

export const bankLedgerSchema = z.object({
	bank: ledgerCodeSchema.nullable(),
	checksIssued: ledgerCodeSchema.nullable(),
	checksInTransit: ledgerCodeSchema.nullable()
})

const bankAccountShape = z.object({
	airesId: z.number().int().positive().nullable(),
	company: companyIdSchema,
	code: z.string().regex(/^[A-Z0-9-]{2,10}$/),
	description: z.string().trim().min(1).max(60),
	entityType: entityTypeSchema,
	institutionId: z.string().trim().min(1).max(40).nullable(),
	branch: z.string().trim().max(60).nullable(),
	accountType: accountTypeSchema,
	currency: currencySchema,
	accountNumber: z.string().trim().max(30).nullable(),
	cbu: cbuSchema.nullable(),
	alias: z
		.string()
		.regex(/^[a-z0-9.-]{6,20}$/)
		.nullable(),
	acceptsChecks: z.boolean(),
	ledger: bankLedgerSchema
})
type Shape = z.infer<typeof bankAccountShape>

/** Lo que depende del tipo de entidad (como `byEntity` del front). */
const byEntity = (account: Shape, ctx: z.RefinementCtx) => {
	if (account.entityType !== 'financial' && !account.institutionId)
		ctx.addIssue({
			code: 'custom',
			path: ['institutionId'],
			message: 'Falta el banco o la billetera.'
		})
	if (account.entityType === 'financial' && account.institutionId)
		ctx.addIssue({
			code: 'custom',
			path: ['institutionId'],
			message: 'Una financiera no lleva banco.'
		})
	if (account.entityType !== 'bank' && account.branch)
		ctx.addIssue({
			code: 'custom',
			path: ['branch'],
			message: 'Sólo los bancos tienen sucursal.'
		})
	if (account.entityType !== 'financial' && !account.cbu)
		ctx.addIssue({
			code: 'custom',
			path: ['cbu'],
			message: 'Falta el CBU o el CVU.'
		})
}

export const bankAccountInputSchema = bankAccountShape.superRefine(byEntity)
export type BankAccountInput = z.infer<typeof bankAccountInputSchema>

export const bankAccountSchema = bankAccountShape.extend({
	id: treasuryIdSchema,
	status: recordStatusSchema,
	version: z.number().int().min(1)
})
export type BankAccount = z.infer<typeof bankAccountSchema>

/** `GET /internal/bank-accounts` y `/balances` */
export const listBankAccountsQuerySchema = z.object({
	query: z.string().trim().max(80).optional(),
	statuses: listParam(recordStatusSchema),
	companies: listParam(companyIdSchema),
	entityTypes: listParam(entityTypeSchema),
	currencies: listParam(currencySchema),
	missingCbu: booleanParam.optional(),
	ids: listParam(treasuryIdSchema)
})
export type ListBankAccountsQuery = z.output<typeof listBankAccountsQuerySchema>
export const listBankAccountsResponseSchema = z.object({
	accounts: z.array(bankAccountSchema)
})

/** `POST /internal/bank-accounts` — con un `id` que ya existe, 200 con la que hay. */
export const createBankAccountRequestSchema = z.object({
	id: treasuryIdSchema.optional(),
	account: bankAccountInputSchema
})
/** `PUT /internal/bank-accounts/:id` — el objeto entero. */
export const updateBankAccountRequestSchema = z.object({
	account: bankAccountInputSchema,
	/** La versión que se editó: si cambió en el medio, `treasury.version_conflict`. */
	version: z.number().int().min(1).optional()
})
export const bankAccountResponseSchema = z.object({
	account: bankAccountSchema
})
/** `GET /internal/bank-accounts/by-cbu/:cbu?exceptId=` — cualquier estado. */
export const findByCbuQuerySchema = z.object({
	exceptId: treasuryIdSchema.optional()
})
export const findByCbuResponseSchema = z.object({
	account: bankAccountSchema.nullable()
})
/** `POST /internal/bank-accounts/status` — baja o recuperación, todo o nada. */
export const setBankAccountsStatusRequestSchema = z.object({
	ids: z.array(treasuryIdSchema).min(1).max(500),
	status: recordStatusSchema
})

/**
 * Saldo de una cuenta (decisión asumida: sin API del banco, el saldo del
 * banco es la suma de lo importado del extracto, y el de Henko, eso menos lo
 * que falta conciliar).
 */
export const bankBalanceSchema = z.object({
	accountId: treasuryIdSchema,
	bankBalance: centsSchema,
	bookBalance: centsSchema,
	asOf: isoDateSchema,
	lastReconciledAt: isoDateSchema.nullable(),
	/** Saldo del banco al cierre de las últimas 8 semanas, la más vieja primero. */
	trend: z.array(centsSchema).length(8)
})
export type BankBalance = z.infer<typeof bankBalanceSchema>
export const bankBalancesResponseSchema = z.object({
	balances: z.array(bankBalanceSchema)
})
