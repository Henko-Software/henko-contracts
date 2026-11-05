import { z } from 'zod'

import {
	airesCodeSchema,
	cbuSchema,
	contactInfoSchema,
	docTypeSchema,
	isoDateSchema,
	lookupCodeSchema,
	provinceSchema,
	recordStatusSchema,
	refineDocNumber,
	supplierFiscalCheckSchema,
	supplierProfileInputSchema,
	vatConditionSchema
} from '@henko-software/contracts-contacts'

import {
	baseContactInfoSchema,
	booleanParam,
	historyEventSchema,
	listParam,
	recordIdSchema,
	statusesParam
} from './common.js'
import { ledgerMovementSchemaFor } from './ledger.js'

/**
 * Proveedores (`/admin/suppliers`): contactos con rol `supplier`, planos
 * como `henko-web/apps/web/src/data/suppliers/schema.ts`. `status` es el
 * del rol.
 */

const profile = supplierProfileInputSchema.shape

const supplierFields = {
	legalName: z.string().trim().min(1).max(160),
	tradeName: z.string().trim().min(1).max(160),
	docType: docTypeSchema,
	docNumber: z.string().max(20),
	vatCondition: vatConditionSchema,
	paymentTermId: profile.paymentTermId,
	discountPct: profile.discountPct,
	purchaseAccount: profile.purchaseAccount,
	joinedAt: profile.joinedAt,
	contact: baseContactInfoSchema.extend({
		streetNumber: contactInfoSchema.shape.streetNumber,
		floor: contactInfoSchema.shape.floor
	}),
	approved: profile.approved,
	serviceProvider: profile.serviceProvider,
	paymentsCustomerNumber: profile.paymentsCustomerNumber,
	tax: profile.tax,
	categories: profile.categories,
	categoriesRaw: profile.categoriesRaw,
	contacts: profile.contacts,
	contactsRaw: profile.contactsRaw,
	payments: profile.payments,
	notes: profile.notes
}

/**
 * CBU nueva que espera aprobación. `requestedBy` es el **nombre** de quien la
 * pidió (lo pone el BFF; `contacts` guarda el id).
 */
export const supplierPendingCbuSchema = z.object({
	cbu: cbuSchema,
	cbuAlias: z.string().max(40).nullable(),
	requestedAt: isoDateSchema,
	requestedBy: z.string().max(80)
})

export const supplierSchema = z.object({
	id: recordIdSchema,
	code: airesCodeSchema,
	...supplierFields,
	lastPurchaseAt: isoDateSchema.nullable(),
	fiscalCheck: supplierFiscalCheckSchema.nullable(),
	pendingCbu: supplierPendingCbuSchema.nullable(),
	status: recordStatusSchema
})
export type Supplier = z.infer<typeof supplierSchema>

/** POST /api/suppliers · PUT /api/suppliers/:id. Una CBU distinta queda pendiente. */
export const supplierInputSchema = z
	.object(supplierFields)
	.superRefine((supplier, context) => refineDocNumber(supplier, context))
export type SupplierInput = z.infer<typeof supplierInputSchema>

/**
 * Cuenta corriente con el proveedor. No es de `contacts`: la calcula
 * `ledger`. `null` sólo si el BFF no tiene `ledger` configurado.
 */
export const supplierAccountSchema = z.object({
	balance: z.number().int(),
	overdue: z.number().int().min(0),
	oldestOverdueDays: z.number().int().min(0),
	nextDue: z
		.object({ date: isoDateSchema, amount: z.number().int().min(0) })
		.nullable(),
	lastPaymentAt: isoDateSchema.nullable()
})

/** En la lista: la cuenta y los otros proveedores con el mismo documento. */
export const supplierListItemSchema = supplierSchema.extend({
	account: supplierAccountSchema.nullable(),
	sameDocIds: z.array(recordIdSchema)
})

export const SUPPLIER_ACCOUNT_STATES = ['up_to_date', 'overdue'] as const

/**
 * GET /api/suppliers — todos los que cumplen, por nombre. `duplicatesOnly`,
 * `caiExpired` y `withIssues` los resuelve el BFF con las reglas del front
 * (hoy en Argentina); `accountStates` y `dueWithinDays`, con la cuenta
 * corriente de `ledger`.
 */
export const listSuppliersQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	statuses: statusesParam,
	categories: listParam(lookupCodeSchema),
	paymentTermIds: listParam(z.uuid()),
	vatConditions: listParam(vatConditionSchema),
	provinces: listParam(provinceSchema),
	approved: listParam(booleanParam),
	accountStates: listParam(z.enum(SUPPLIER_ACCOUNT_STATES)),
	duplicatesOnly: booleanParam.optional(),
	caiExpired: booleanParam.optional(),
	withIssues: booleanParam.optional(),
	dueWithinDays: z.coerce.number().int().min(0).max(3650).optional()
})
export type ListSuppliersQuery = z.output<typeof listSuppliersQuerySchema>

export const listSuppliersResponseSchema = z.object({
	suppliers: z.array(supplierListItemSchema)
})

export const SUPPLIER_MOVEMENT_KINDS = [
	'invoice',
	'payment_order',
	'credit_note',
	'debit_note'
] as const
export const supplierMovementKindSchema = z.enum(SUPPLIER_MOVEMENT_KINDS)

/** Punto de venta y número: 00004-00012845 (o 0001-00004512 en las OP). */
const supplierDocumentNumberSchema = z.string().regex(/^\d{4,5}-\d{8}$/)

/**
 * Un comprobante de la cuenta corriente con el proveedor (`SupplierMovement`
 * del front): el comprobante unificado de `ledger.ts`, con los tipos de un
 * proveedor.
 */
export const supplierMovementSchema = ledgerMovementSchemaFor(
	SUPPLIER_MOVEMENT_KINDS,
	supplierDocumentNumberSchema
)
/** Qué comprobante canceló a cuál (Aires: grilla «Aplicaciones»). */
export const supplierMovementApplicationSchema =
	supplierMovementSchema.shape.applications.element
export type SupplierMovement = z.infer<typeof supplierMovementSchema>

/** GET /api/suppliers/:id — la ficha, con sus comprobantes del más nuevo al más viejo. */
export const supplierDetailResponseSchema = z.object({
	supplier: supplierSchema,
	account: supplierAccountSchema.nullable(),
	movements: z.array(supplierMovementSchema),
	history: z.array(historyEventSchema),
	sameDoc: z.array(
		supplierSchema.pick({
			id: true,
			code: true,
			tradeName: true,
			status: true
		})
	)
})

export const supplierResponseSchema = z.object({ supplier: supplierSchema })

/** GET /api/suppliers/by-doc/:digits — los proveedores con ese documento. */
export const suppliersByDocResponseSchema = z.object({
	suppliers: z.array(supplierSchema)
})

/** POST /api/suppliers/approved. 204. */
export const setApprovedBodySchema = z.object({
	ids: z.array(recordIdSchema).min(1).max(500),
	approved: z.boolean()
})

/**
 * POST /api/suppliers/:id/cbu/approve · /reject. 204. Quien la pidió no la
 * puede aprobar: 409 `contacts.cbu_same_requester` (el front lo muestra como
 * `H-PV003`).
 */

/**
 * GET /api/suppliers/payables?…mismos filtros que la lista — lo que hay que
 * pagar (`SupplierPayable` del front): facturas y notas de débito con saldo
 * y vencimiento, cada una con lo suyo (sin descontar notas de crédito ni
 * anticipos). `pending` en pesos.
 */
export const supplierPayableSchema = z.object({
	supplierId: z.string(),
	movementId: z.string(),
	kind: z.enum(['invoice', 'debit_note']),
	letter: z.enum(['A', 'B', 'C', 'M', 'X']).nullable(),
	number: supplierDocumentNumberSchema,
	description: z.string().max(120).nullable(),
	date: isoDateSchema,
	dueDate: isoDateSchema,
	currency: z.enum(['ARS', 'USD']),
	exchangeRate: z.number().positive(),
	pending: z.number().int().positive()
})
export type SupplierPayable = z.infer<typeof supplierPayableSchema>
export const supplierPayablesResponseSchema = z.object({
	payables: z.array(supplierPayableSchema)
})

/**
 * GET /api/suppliers/purchase-accounts — las cuentas para «Cuenta default de
 * compras»: las imputables activas del plan aptas para compras.
 */
export const purchaseAccountSchema = z.object({
	code: z.string().regex(/^\d-\d-\d{2}-\d-\d{3}$/),
	name: z.string().trim().min(1).max(80)
})
export const purchaseAccountsResponseSchema = z.object({
	accounts: z.array(purchaseAccountSchema)
})
