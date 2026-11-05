import { z } from 'zod'

import { isoDateSchema } from '@henko-software/contracts-contacts'

import {
	booleanParam,
	categoryAmountSchema,
	centsSchema,
	companyIdSchema,
	currencySchema,
	documentNumberSchema,
	ledgerPartySchema,
	letterSchema,
	listParam,
	manualKindSchema,
	movementKindSchema,
	positiveCentsSchema,
	sourceModuleSchema
} from './common.js'

/**
 * Cuenta corriente de `ledger`. Una cuenta es (lado, contacto): el contacto
 * es el id de `contacts`. Cada movimiento es un comprobante que suma o baja
 * deuda; las imputaciones dicen qué cancela a qué. Todo lo que se calcula
 * (saldo, pendiente, tramos, vencimientos) lo calcula `ledger` con las mismas
 * reglas que el front (`henko-web/apps/web/src/data/customers/schema.ts`:
 * `agingOf`, `openInvoicesOf`).
 *
 * Alcance: un contacto de un local lo ve quien ve ese local (como en
 * `contacts`); `ledger` sabe de qué local es cada contacto por los eventos
 * de `contacts`. Fuera de alcance = 404.
 */

/**
 * Una cuota de un comprobante: cuándo vence y cuánto (en pesos). Una factura
 * con condición 30/60 días tiene dos (decisión asumida 13: una cuota por
 * plazo de la condición de pago). Lo cobrado cancela primero la cuota que
 * vence antes.
 */
export const installmentSchema = z.object({
	dueDate: isoDateSchema,
	amount: positiveCentsSchema
})
export type Installment = z.infer<typeof installmentSchema>

/** Una imputación vista desde un movimiento: el otro comprobante y cuánto. */
export const movementApplicationSchema = z.object({
	/** La última imputación entre los dos (para deshacer, se usa el par). */
	id: z.uuid(),
	/** El otro movimiento. */
	movementId: z.uuid(),
	date: isoDateSchema,
	kind: movementKindSchema,
	number: documentNumberSchema,
	/** Lo aplicado neto entre los dos, en centavos (siempre positivo). */
	amount: positiveCentsSchema
})

export const movementSchema = z.object({
	id: z.uuid(),
	party: ledgerPartySchema,
	contactId: z.uuid(),
	kind: movementKindSchema,
	letter: letterSchema.nullable(),
	number: documentNumberSchema,
	date: isoDateSchema,
	/** El último vencimiento (con cuotas, el de la última). */
	dueDate: isoDateSchema.nullable(),
	/** Las cuotas, de la primera a la última; vacío = una sola, `dueDate`. */
	installments: z.array(installmentSchema),
	description: z.string().max(120).nullable(),
	companyId: companyIdSchema.nullable(),
	currency: currencySchema,
	/** Cotización a pesos del día del comprobante (1 en pesos). */
	exchangeRate: z.number().positive(),
	/** El importe en la moneda del comprobante, con signo. */
	originalAmount: centsSchema,
	/** En pesos: positivo suma deuda, negativo la baja. */
	amount: centsSchema,
	/** Lo ya imputado (neto). */
	applied: z.number().int().min(0),
	/** Lo que falta imputar: `|amount| - applied`. 0 = cancelado. */
	pending: z.number().int().min(0),
	settled: z.boolean(),
	applications: z.array(movementApplicationSchema),
	/** Vendedor del cliente cuando se emitió (ventas). */
	salespersonId: z.uuid().nullable(),
	/** Lo de cada rubro (ventas); vacío si no vino. */
	categories: z.array(categoryAmountSchema),
	source: z.object({
		module: sourceModuleSchema,
		/** El id del comprobante en su módulo; `null` en los cargados a mano. */
		documentId: z.string().nullable()
	}),
	/** Si es un contra-asiento, el movimiento que corrige. */
	reversalOf: z.uuid().nullable(),
	/** Si lo corrigieron, el contra-asiento. */
	reversedBy: z.uuid().nullable(),
	createdAt: z.iso.datetime()
})
export type Movement = z.infer<typeof movementSchema>

export const AGING_BUCKETS = [
	'current',
	'days30',
	'days60',
	'days90',
	'over90'
] as const
export const agingBucketsSchema = z.object({
	current: z.number().int().min(0),
	days30: z.number().int().min(0),
	days60: z.number().int().min(0),
	days90: z.number().int().min(0),
	over90: z.number().int().min(0)
})
export type AgingBuckets = z.infer<typeof agingBucketsSchema>

/**
 * Resumen de una cuenta a una fecha (`asOf`, hoy en Argentina si no viene).
 *
 * - `buckets`: lo que se debe por antigüedad. Lo no imputado (recibos, OP y
 *   notas de crédito sin aplicar) se descuenta de lo que venció primero
 *   (FIFO); los tramos suman `max(0, balance)` y lo que sobra es `credit`.
 * - `overdue`: todos los tramos menos `current`.
 * - `nextDue`: el próximo vencimiento (desde `asOf`) y cuánto vence ese día.
 * - `avgDaysLate`: cuántos días después del vencimiento se cancelaron, en
 *   promedio, las facturas de los últimos seis meses; `null` si ninguna.
 * - `orderEveryDays`: cada cuántos días hubo factura, en promedio, en los
 *   últimos seis meses; `null` con menos de tres.
 */
export const accountSummarySchema = z.object({
	party: ledgerPartySchema,
	contactId: z.uuid(),
	balance: centsSchema,
	overdue: z.number().int().min(0),
	oldestOverdueDays: z.number().int().min(0),
	buckets: agingBucketsSchema,
	credit: z.number().int().min(0),
	nextDue: z
		.object({ date: isoDateSchema, amount: z.number().int().min(0) })
		.nullable(),
	lastPaymentAt: isoDateSchema.nullable(),
	avgDaysLate: z.number().int().min(0).nullable(),
	orderEveryDays: z.number().int().min(1).nullable()
})
export type AccountSummary = z.infer<typeof accountSummarySchema>

/**
 * GET /internal/accounts?party=customer&contactIds=&asOf= — las cuentas con
 * algún movimiento, al alcance de quien pide. Sin `contactIds`, todas.
 */
export const listAccountsQuerySchema = z.object({
	party: ledgerPartySchema,
	contactIds: listParam(z.uuid()),
	asOf: isoDateSchema.optional()
})
export type ListAccountsQuery = z.output<typeof listAccountsQuerySchema>
export const listAccountsResponseSchema = z.object({
	accounts: z.array(accountSummarySchema)
})

/**
 * GET /internal/accounts/:party/:contactId?asOf= — la cuenta con sus
 * movimientos, del más nuevo al más viejo. Sin movimientos, saldo cero.
 */
export const accountDetailQuerySchema = z.object({
	asOf: isoDateSchema.optional()
})
export const accountDetailResponseSchema = z.object({
	account: accountSummarySchema,
	movements: z.array(movementSchema)
})

/**
 * Lo que queda de una factura o nota de débito sin cancelar, una fila por
 * cuota abierta (mismo `movementId`). Con `net=true`
 * se descuenta antes lo no imputado de la cuenta, de lo que vence primero
 * (como `openInvoicesOf` del front: cobranzas esperadas); sin `net`, cada
 * comprobante con lo suyo (agenda de pagos a proveedores).
 */
export const openItemSchema = z.object({
	contactId: z.uuid(),
	movementId: z.uuid(),
	kind: movementKindSchema,
	letter: letterSchema.nullable(),
	number: documentNumberSchema,
	description: z.string().max(120).nullable(),
	date: isoDateSchema,
	/** El vencimiento de esta cuota (o del comprobante, si es una sola). */
	dueDate: isoDateSchema.nullable(),
	/** Qué cuota es (1, 2…); `null` si el comprobante tiene una sola. */
	installment: z.number().int().min(1).nullable().default(null),
	companyId: companyIdSchema.nullable(),
	currency: currencySchema,
	exchangeRate: z.number().positive(),
	/** Lo que falta, en pesos. */
	pending: positiveCentsSchema
})
export type OpenItem = z.infer<typeof openItemSchema>

/** GET /internal/open-items?party=&net=&contactIds= */
export const listOpenItemsQuerySchema = z.object({
	party: ledgerPartySchema,
	net: booleanParam.optional(),
	contactIds: listParam(z.uuid())
})
export type ListOpenItemsQuery = z.output<typeof listOpenItemsQuerySchema>
export const listOpenItemsResponseSchema = z.object({
	items: z.array(openItemSchema)
})

/** Lo facturado y lo cobrado, en centavos. */
export const salesAmountsSchema = z.object({
	amount: centsSchema,
	collected: centsSchema
})

/**
 * GET /internal/sales-by-salesperson?months=6&asOf= — por vendedor (el que
 * vino en cada comprobante de venta): lo facturado (facturas y notas de
 * débito menos notas de crédito) y lo cobrado (recibos) por mes calendario,
 * del más viejo al más nuevo (el último es el mes de `asOf`); y el mes en
 * curso por rubro (lo cobrado de un rubro: lo imputado a sus facturas,
 * repartido según lo de cada rubro).
 */
export const salesBySalespersonQuerySchema = z.object({
	months: z.coerce.number().int().min(1).max(24).default(6),
	asOf: isoDateSchema.optional()
})
export const salespersonSalesSchema = z.object({
	salespersonId: z.uuid(),
	months: z.array(salesAmountsSchema.extend({ period: z.string() })),
	categories: z.array(salesAmountsSchema.extend({ category: z.string() }))
})
export type SalespersonSales = z.infer<typeof salespersonSalesSchema>
export const salesBySalespersonResponseSchema = z.object({
	sales: z.array(salespersonSalesSchema)
})

// ---------- Escritura a mano (con permiso y auditoría)

/**
 * POST /internal/adjustments — saldo inicial (migración) o ajuste. `amount`
 * con signo: positivo suma deuda. Con un `id` que ya existe no duplica: 200
 * con el que hay. Lo numera `ledger` (`0000-0000000N`).
 */
export const createAdjustmentRequestSchema = z.object({
	id: z.uuid().optional(),
	party: ledgerPartySchema,
	contactId: z.uuid(),
	kind: manualKindSchema,
	date: isoDateSchema,
	dueDate: isoDateSchema.nullable(),
	amount: centsSchema.refine(value => value !== 0, {
		message: 'No puede ser cero'
	}),
	description: z.string().trim().min(1).max(120),
	companyId: companyIdSchema.nullable().default(null)
})
export type CreateAdjustmentRequest = z.output<
	typeof createAdjustmentRequestSchema
>

export const movementResponseSchema = z.object({ movement: movementSchema })

/**
 * POST /internal/movements/:id/reverse — contra-asiento de un movimiento
 * cargado a mano (saldo inicial o ajuste). Deshace sus imputaciones y lo
 * cancela con uno igual de signo opuesto. Los comprobantes de otros módulos
 * se anulan con su evento o comando (`void-document`).
 */
export const reverseMovementRequestSchema = z.object({
	date: isoDateSchema.optional(),
	reason: z.string().trim().min(1).max(120)
})

/**
 * POST /internal/applications — imputa a mano un comprobante que baja deuda
 * (`creditId`) a uno que la suma (`debitId`), de la misma cuenta. Sin
 * `amount`, lo más que se pueda.
 */
export const createApplicationRequestSchema = z.object({
	debitId: z.uuid(),
	creditId: z.uuid(),
	amount: positiveCentsSchema.optional(),
	date: isoDateSchema.optional()
})

/** POST /internal/applications/undo — deshace lo imputado entre los dos. */
export const undoApplicationRequestSchema = z.object({
	debitId: z.uuid(),
	creditId: z.uuid()
})

// ---------- Comprobantes de otros módulos (eventos y comandos)

/**
 * Qué comprobante imputa a cuál: el id del otro en su módulo (o el id del
 * movimiento en `ledger`, como lo eligen Tesorería y la pantalla) y cuánto
 * (en pesos). Si al anotarlo ya no debe tanto, se imputa lo que se puede y
 * el resto queda a cuenta: el comprobante nunca se pierde.
 */
export const documentApplicationSchema = z.object({
	documentId: z.string().min(1).max(80),
	amount: positiveCentsSchema
})

/**
 * Un comprobante de otro módulo como lo anota `ledger`. Los importes van en
 * positivo: el signo lo pone el tipo. `applications` dice a qué comprobantes
 * de la misma cuenta cancela (un recibo a facturas, una nota de crédito a
 * su factura); lo que sobra queda a cuenta.
 */
export const ledgerDocumentSchema = z.object({
	/** El id en su módulo. Un mismo comprobante se anota una sola vez. */
	id: z.string().min(1).max(80),
	kind: z.enum([
		'invoice',
		'debit_note',
		'credit_note',
		'receipt',
		'payment_order'
	]),
	contactId: z.uuid(),
	companyId: companyIdSchema.nullable(),
	letter: letterSchema.nullable(),
	number: documentNumberSchema,
	date: isoDateSchema,
	/** El último vencimiento (con cuotas, el de la última). */
	dueDate: isoDateSchema.nullable(),
	/**
	 * Las cuotas, de la primera a la última. La suma tiene que dar `amount` y
	 * la última vencer en `dueDate`. Vacío o ausente = una sola cuota
	 * (`dueDate` por `amount`).
	 */
	installments: z.array(installmentSchema).max(60).default([]),
	description: z.string().max(120).nullable(),
	currency: currencySchema,
	exchangeRate: z.number().positive(),
	originalAmount: positiveCentsSchema,
	/** En pesos. */
	amount: positiveCentsSchema,
	salespersonId: z.uuid().nullable().default(null),
	/**
	 * Lo de cada rubro de artículo, en pesos y en positivo. Puede venir una
	 * entrada por línea (el mismo rubro repetido): `ledger` las suma.
	 */
	categories: z.array(categoryAmountSchema).max(500).default([]),
	applications: z.array(documentApplicationSchema).default([])
})
export type LedgerDocument = z.output<typeof ledgerDocumentSchema>

/**
 * POST /internal/commands/record-document — el orquestador anota un
 * comprobante. Idempotente: con el mismo `module` + `document.id`, devuelve
 * el movimiento que ya está (200); nuevo, 201. Lleva `Idempotency-Key`.
 */
export const recordDocumentCommandSchema = z.object({
	party: ledgerPartySchema,
	module: z.enum(['sales', 'purchases', 'treasury']),
	document: ledgerDocumentSchema
})
export type RecordDocumentCommand = z.output<typeof recordDocumentCommandSchema>

/**
 * POST /internal/commands/void-document — un comprobante anulado: su
 * contra-asiento. Idempotente (anular dos veces deja uno).
 */
export const voidDocumentCommandSchema = z.object({
	party: ledgerPartySchema,
	module: z.enum(['sales', 'purchases', 'treasury']),
	documentId: z.string().min(1).max(80),
	date: isoDateSchema,
	reason: z.string().trim().min(1).max(120).nullable().default(null)
})
export type VoidDocumentCommand = z.output<typeof voidDocumentCommandSchema>

// ---------- Empresas (razones sociales de la casa central)

/**
 * Una razón social de la casa central (Aires: «Empresa»). La lista es de
 * cada instancia (configuración de `ledger`, decisión asumida 7); la que
 * tiene `isDefault` es la que se usa cuando un comprobante no dice cuál.
 */
export const companySchema = z.object({
	id: companyIdSchema,
	/** El número de empresa de Aires (`1`, `2`). */
	code: z.string().trim().min(1).max(10),
	name: z.string().trim().min(1).max(120),
	isDefault: z.boolean()
})
export type Company = z.infer<typeof companySchema>

/** GET /internal/companies — las de la instancia, la de por defecto primero. */
export const listCompaniesResponseSchema = z.object({
	companies: z.array(companySchema).min(1)
})
