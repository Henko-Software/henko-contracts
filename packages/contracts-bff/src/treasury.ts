import { z } from 'zod'

import {
	applicationSchema,
	bankAccountInputSchema,
	bankBalanceSchema,
	billCountSchema,
	billsTotal,
	cashEntryInputSchema,
	cashEntrySchema,
	chequeSchema,
	chequeStatusSchema,
	currencySchema,
	documentNumberSchema,
	entityTypeSchema,
	isoDateSchema,
	listParam,
	nextNumberResponseSchema,
	paymentValueSchema,
	projectionResponseSchema,
	RECEIPT_STATES,
	RECEIPT_VALUE_KINDS,
	receiptChequeSchema,
	receiptValueInputSchema,
	recordStatusSchema,
	statementMatchSchema,
	statementRowSchema,
	statementStatusSchema,
	voidedSchema,
	voidRequestSchema,
	withholdingSchema
} from '@henko-software/contracts-treasury'

import { historyEventSchema } from './admin/common.js'
import { supplierPayableSchema } from './admin/suppliers.js'

/**
 * Tesorería (`/treasury/receipts`, `/treasury/cheques`, `/treasury/payments`,
 * `/admin/bank-accounts`, `/treasury/cash`), armada con `treasury`. Las
 * formas copian
 * `henko-web/apps/web/src/data/{receipts,payment_orders,cheques,bank_accounts,bank_statements,cash_plan}/schema.ts`:
 * el BFF pone el nombre de quien registró (vacío si fue un superadmin y
 * quien mira no lo es), trae de ledger lo que debe cada factura y de
 * contacts el cliente o proveedor, y saca lo interno.
 */

const sumOf = (rows: { amount: number }[]) =>
	rows.reduce((total, row) => total + row.amount, 0)

// ---------- Cobranzas (flag `treasury.receipts`)

export const bffReceiptValueSchema = z.object({
	kind: z.enum(RECEIPT_VALUE_KINDS),
	amount: z.number().int().positive(),
	bankAccountId: z.string().nullable(),
	cheque: receiptChequeSchema.nullable(),
	/** El cheque con que quedó en la cartera (cheques y e-cheq). */
	chequeId: z.string().nullable()
})

export const bffReceiptSchema = z.object({
	id: z.string(),
	number: documentNumberSchema,
	customerId: z.string(),
	date: isoDateSchema,
	values: z.array(bffReceiptValueSchema).min(1),
	withholdings: z.array(withholdingSchema),
	applications: z.array(applicationSchema),
	notes: z.string().max(500).nullable(),
	/** Nombre de quien lo registró. */
	createdBy: z.string(),
	/** Anulado: cuándo y por qué (contra-asiento en la cuenta corriente). */
	voided: voidedSchema
})
export type BffReceipt = z.infer<typeof bffReceiptSchema>

/** POST /api/receipts — `ReceiptInput` del front. `H-RC002` = `treasury.receipt_application_exceeds`. */
export const bffReceiptInputSchema = z
	.object({
		customerId: z.uuid(),
		date: isoDateSchema,
		values: z.array(receiptValueInputSchema).min(1).max(50),
		withholdings: z.array(withholdingSchema).max(20),
		applications: z.array(applicationSchema).max(200),
		notes: z.string().trim().max(500).nullable()
	})
	.superRefine((input, ctx) => {
		if (
			sumOf(input.applications) >
			sumOf(input.values) + sumOf(input.withholdings)
		)
			ctx.addIssue({
				code: 'custom',
				path: ['applications'],
				message: 'Se aplica más de lo que entró.'
			})
		const ids = input.applications.map(row => row.movementId)
		if (new Set(ids).size !== ids.length)
			ctx.addIssue({
				code: 'custom',
				path: ['applications'],
				message: 'Una factura está más de una vez.'
			})
	})
export type BffReceiptInput = z.infer<typeof bffReceiptInputSchema>

/** GET /api/receipts?query=&customerIds=&states=&dateFrom=&dateTo= */
export const listBffReceiptsQuerySchema = z.object({
	query: z.string().trim().max(80).optional(),
	customerIds: listParam(z.uuid()),
	states: listParam(z.enum(RECEIPT_STATES)),
	dateFrom: isoDateSchema.optional(),
	dateTo: isoDateSchema.optional()
})
export const listBffReceiptsResponseSchema = z.object({
	receipts: z.array(bffReceiptSchema)
})
export const bffReceiptResponseSchema = z.object({ receipt: bffReceiptSchema })
/** GET /api/receipts/:id */
export const bffReceiptDetailResponseSchema = z.object({
	receipt: bffReceiptSchema,
	history: z.array(historyEventSchema)
})
/** GET /api/receipts/next-number · GET /api/payment-orders/next-number */
export const bffNextNumberResponseSchema = nextNumberResponseSchema
/** POST /api/receipts/:id/void · POST /api/payment-orders/:id/void */
export const bffVoidBodySchema = voidRequestSchema

/**
 * GET /api/receipts/open-items/:customerId — las facturas y notas de débito
 * del cliente con algo para cobrar, lo que vence primero, primero (de
 * ledger; con cuotas, el vencimiento de la primera abierta).
 */
export const bffReceiptOpenItemSchema = z.object({
	movementId: z.string(),
	kind: z.enum(['invoice', 'debit_note']),
	number: z.string(),
	date: isoDateSchema,
	dueDate: isoDateSchema.nullable(),
	pending: z.number().int().positive()
})
export const bffReceiptOpenItemsResponseSchema = z.object({
	items: z.array(bffReceiptOpenItemSchema)
})

// ---------- Cheques (flag `treasury.cheques`)

export const bffChequeSchema = chequeSchema.omit({ localId: true }).extend({
	id: z.string(),
	customerId: z.string(),
	receiptId: z.string(),
	depositedTo: z.string().nullable(),
	endorsedTo: z.string().nullable(),
	paymentOrderId: z.string().nullable()
})
export type BffCheque = z.infer<typeof bffChequeSchema>

/** GET /api/cheques?query=&statuses=&customerIds= */
export const listBffChequesQuerySchema = z.object({
	query: z.string().trim().max(80).optional(),
	statuses: listParam(chequeStatusSchema),
	customerIds: listParam(z.uuid())
})
export const listBffChequesResponseSchema = z.object({
	cheques: z.array(bffChequeSchema)
})
/** Un paso del recorrido, ya legible (la cuenta, el proveedor o el motivo). */
export const bffChequeEventSchema = z.object({
	status: chequeStatusSchema,
	date: isoDateSchema,
	detail: z.string().nullable()
})
export const bffChequeDetailResponseSchema = z.object({
	cheque: bffChequeSchema,
	history: z.array(bffChequeEventSchema)
})
/** POST /api/cheques/deposit */
export const bffDepositChequesBodySchema = z.object({
	ids: z.array(z.uuid()).min(1).max(500),
	bankAccountId: z.uuid(),
	date: isoDateSchema
})
/** POST /api/cheques/credit */
export const bffCreditChequesBodySchema = z.object({
	ids: z.array(z.uuid()).min(1).max(500),
	date: isoDateSchema
})
/** POST /api/cheques/endorse */
export const bffEndorseChequesBodySchema = z.object({
	ids: z.array(z.uuid()).min(1).max(500),
	supplierId: z.uuid(),
	date: isoDateSchema
})
/** POST /api/cheques/:id/reject */
export const bffRejectChequeBodySchema = z.object({
	reason: z.string().trim().min(1).max(120),
	date: isoDateSchema
})

// ---------- Pagos (flag `treasury.payments`)

export const bffPaymentValueSchema = z.object({
	kind: z.enum(['transfer', 'endorsed', 'echeq', 'cash']),
	amount: z.number().int().positive(),
	bankAccountId: z.string().nullable(),
	chequeId: z.string().nullable(),
	echeq: z.object({ number: z.string(), payDate: isoDateSchema }).nullable(),
	bills: z.array(billCountSchema).nullish()
})
export const bffPaymentOrderSchema = z.object({
	id: z.string(),
	number: documentNumberSchema,
	supplierId: z.string(),
	date: isoDateSchema,
	applications: z.array(applicationSchema),
	values: z.array(bffPaymentValueSchema).min(1),
	notes: z.string().max(500).nullable(),
	delivered: z.boolean(),
	deliveredAt: isoDateSchema.nullable(),
	createdBy: z.string(),
	voided: voidedSchema
})
export type BffPaymentOrder = z.infer<typeof bffPaymentOrderSchema>

/**
 * POST /api/payment-orders — `PaymentOrderInput` del front: el efectivo va
 * con los billetes. `H-OP002` = `treasury.payment_application_exceeds`;
 * `H-CH002` = `treasury.cheque_not_available`.
 */
export const bffPaymentOrderInputSchema = z
	.object({
		supplierId: z.uuid(),
		date: isoDateSchema,
		applications: z.array(applicationSchema).max(200),
		values: z.array(paymentValueSchema).min(1).max(50),
		notes: z.string().trim().max(500).nullable()
	})
	.superRefine((input, ctx) => {
		if (sumOf(input.values) < sumOf(input.applications))
			ctx.addIssue({
				code: 'custom',
				path: ['values'],
				message: 'Lo que se paga no alcanza para lo que se aplica.'
			})
		input.values.forEach((value, index) => {
			if (
				value.kind === 'cash' &&
				(!value.bills?.length || billsTotal(value.bills) !== value.amount)
			)
				ctx.addIssue({
					code: 'custom',
					path: ['values', index, 'bills'],
					message: 'El efectivo va con los billetes que se entregan.'
				})
		})
	})
export type BffPaymentOrderInput = z.infer<typeof bffPaymentOrderInputSchema>

/** GET /api/payment-orders?query=&supplierIds=&delivered=&dateFrom=&dateTo= */
export const listBffPaymentOrdersQuerySchema = z.object({
	query: z.string().trim().max(80).optional(),
	supplierIds: listParam(z.uuid()),
	delivered: z
		.enum(['true', 'false'])
		.transform(value => value === 'true')
		.optional(),
	dateFrom: isoDateSchema.optional(),
	dateTo: isoDateSchema.optional()
})
export const listBffPaymentOrdersResponseSchema = z.object({
	orders: z.array(bffPaymentOrderSchema)
})
export const bffPaymentOrderResponseSchema = z.object({
	order: bffPaymentOrderSchema
})
export const bffPaymentOrderDetailResponseSchema = z.object({
	order: bffPaymentOrderSchema,
	history: z.array(historyEventSchema)
})
/** GET /api/payment-orders/payables — lo mismo que `/api/suppliers/payables`, de los proveedores activos. */
export const bffPayablesResponseSchema = z.object({
	payables: z.array(supplierPayableSchema)
})
/** POST /api/payment-orders/delivered */
export const bffSetDeliveredBodySchema = z.object({
	ids: z.array(z.uuid()).min(1).max(500),
	delivered: z.boolean(),
	date: isoDateSchema
})

// ---------- Cuentas bancarias (flag `treasury.bankAccounts`)

export const bffBankAccountSchema = bankAccountInputSchema.safeExtend({
	id: z.string(),
	status: recordStatusSchema
})
export type BffBankAccount = z.infer<typeof bffBankAccountSchema>
/** POST /api/bank-accounts · PUT /api/bank-accounts/:id */
export const bffBankAccountInputSchema = bankAccountInputSchema
/** GET /api/bank-accounts?query=&statuses=&companies=&entityTypes=&currencies=&missingCbu= */
export const listBffBankAccountsQuerySchema = z.object({
	query: z.string().trim().max(80).optional(),
	statuses: listParam(recordStatusSchema),
	companies: listParam(z.string().trim().min(1).max(40)),
	entityTypes: listParam(entityTypeSchema),
	currencies: listParam(currencySchema),
	missingCbu: z
		.enum(['true', 'false'])
		.transform(value => value === 'true')
		.optional()
})
export const listBffBankAccountsResponseSchema = z.object({
	accounts: z.array(bffBankAccountSchema)
})
export const bffBankAccountResponseSchema = z.object({
	account: bffBankAccountSchema
})
/** GET /api/bank-accounts/by-cbu/:cbu?exceptId= */
export const bffBankAccountByCbuResponseSchema = z.object({
	account: bffBankAccountSchema.nullable()
})
/** POST /api/bank-accounts/status */
export const bffSetBankAccountsStatusBodySchema = z.object({
	ids: z.array(z.uuid()).min(1).max(500),
	status: recordStatusSchema
})
/** GET /api/bank-accounts/balances?…mismos filtros que la lista */
export const bffBankBalancesResponseSchema = z.object({
	balances: z.array(bankBalanceSchema)
})

// ---------- Extractos (flag `treasury.bankAccounts`)

export const bffStatementLineSchema = z.object({
	id: z.string(),
	accountId: z.string(),
	date: isoDateSchema,
	description: z.string().max(200),
	amount: z.number().int(),
	cuit: z.string().nullable(),
	status: statementStatusSchema,
	match: statementMatchSchema.nullable()
})
/** GET /api/bank-accounts/:id/statement?statuses= */
export const listBffStatementQuerySchema = z.object({
	statuses: listParam(statementStatusSchema)
})
export const listBffStatementResponseSchema = z.object({
	lines: z.array(bffStatementLineSchema)
})
/** Lo que propone Henko: coincide, lo dice el banco o parece de un cliente (por el CUIT). */
export const bffSuggestionSchema = z.union([
	z.object({
		confidence: z.enum(['match', 'rule']),
		match: statementMatchSchema
	}),
	z.object({
		confidence: z.literal('guess'),
		customerId: z.string(),
		label: z.string()
	})
])
/** GET /api/bank-accounts/:id/statement/suggestions */
export const bffSuggestionsResponseSchema = z.object({
	suggestions: z.record(z.string(), bffSuggestionSchema)
})
/** POST /api/bank-accounts/:id/statement */
export const bffImportStatementBodySchema = z.object({
	rows: z.array(statementRowSchema).min(1).max(5000)
})
export const bffImportStatementResponseSchema = z.object({
	added: z.number().int().min(0),
	duplicates: z.number().int().min(0)
})
/** POST /api/bank-statements/confirm — `H-BS002` = `treasury.statement_line_not_pending`. */
export const bffConfirmStatementBodySchema = z.object({
	items: z
		.array(z.object({ lineId: z.uuid(), match: statementMatchSchema }))
		.min(1)
		.max(500)
})
/** POST /api/bank-statements/ignore */
export const bffIgnoreStatementBodySchema = z.object({
	ids: z.array(z.uuid()).min(1).max(500)
})
/**
 * GET /api/bank-statements/unreceipted — «En el banco, sin recibo»: lo que
 * entró, por revisar y sin coincidencia, con el cliente que parece (por el
 * CUIT del detalle) si hay uno.
 */
export const bffUnreceiptedResponseSchema = z.object({
	lines: z.array(
		bffStatementLineSchema.extend({
			customerId: z.string().nullable(),
			customerName: z.string().nullable()
		})
	)
})

// ---------- Caja proyectada (flag `treasury.cashPlan`)

/** GET /api/cash-plan/entries · POST · PUT /:id · DELETE /:id */
export const bffCashEntrySchema = cashEntrySchema.extend({ id: z.string() })
export const bffCashEntryInputSchema = cashEntryInputSchema
export const bffCashEntriesResponseSchema = z.object({
	entries: z.array(bffCashEntrySchema)
})
export const bffCashEntryResponseSchema = z.object({
	entry: bffCashEntrySchema
})
/**
 * GET /api/cash-plan?days=30&minimum= — la caja proyectada armada en el back
 * (lo que hoy arma `useCashPlan` del front con ocho listas).
 */
export const bffCashPlanQuerySchema = z.object({
	days: z.coerce.number().int().min(1).max(120).default(30),
	minimum: z.coerce.number().int().default(0)
})
export const bffCashPlanResponseSchema = projectionResponseSchema
