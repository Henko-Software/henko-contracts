import { z } from 'zod'

export { booleanParam, listParam } from '@henko-software/contracts-common'

/**
 * Piezas comunes del contrato de `ledger`. La plata va siempre en centavos
 * enteros (nunca `float`); las fechas de los comprobantes, `YYYY-MM-DD`.
 */

/** Centavos enteros, con signo. */
export const centsSchema = z.number().int().refine(Number.isSafeInteger, {
	message: 'Fuera de rango'
})
/** Centavos enteros mayores que cero. */
export const positiveCentsSchema = centsSchema.refine(value => value > 0, {
	message: 'Tiene que ser mayor que cero'
})

/**
 * De qué lado está la cuenta corriente: lo que nos debe un cliente
 * (`customer`) o lo que le debemos a un proveedor (`supplier`). En los dos,
 * un importe positivo suma deuda (factura, nota de débito) y uno negativo la
 * baja (recibo u orden de pago, nota de crédito).
 */
export const LEDGER_PARTIES = ['customer', 'supplier'] as const
export const ledgerPartySchema = z.enum(LEDGER_PARTIES)
export type LedgerParty = z.infer<typeof ledgerPartySchema>

/**
 * Qué es cada movimiento:
 *
 * - `invoice`, `debit_note`: suman deuda (positivos).
 * - `credit_note`, `receipt` (sólo clientes), `payment_order` (sólo
 *   proveedores): la bajan (negativos).
 * - `opening_balance`: saldo inicial de la migración; `adjustment`: ajuste a
 *   mano. Con signo, como cualquiera.
 * - `reversal`: el contra-asiento de otro movimiento (mismo importe con el
 *   signo opuesto). Los movimientos no se editan ni se borran: se corrigen así.
 */
export const MOVEMENT_KINDS = [
	'invoice',
	'debit_note',
	'credit_note',
	'receipt',
	'payment_order',
	'opening_balance',
	'adjustment',
	'reversal'
] as const
export const movementKindSchema = z.enum(MOVEMENT_KINDS)
export type MovementKind = z.infer<typeof movementKindSchema>

/** Los que entran a mano (con permiso y auditoría). */
export const MANUAL_KINDS = ['opening_balance', 'adjustment'] as const
export const manualKindSchema = z.enum(MANUAL_KINDS)
export type ManualKind = z.infer<typeof manualKindSchema>

/** Letra de la factura o nota (A, B, C, M; la X es lo que se carga hoy en Aires). */
export const LETTERS = ['A', 'B', 'C', 'M', 'X'] as const
export const letterSchema = z.enum(LETTERS)

/** Punto de venta y número: 0003-00012845 (o 00004-00012845). */
export const documentNumberSchema = z.string().regex(/^\d{4,5}-\d{8}$/)

export const CURRENCIES = ['ARS', 'USD'] as const
export const currencySchema = z.enum(CURRENCIES)

/**
 * La razón social de la casa central que emitió o recibió el comprobante.
 * Texto opaco: la lista es de cada instancia. `null` = la única que hay.
 */
export const companyIdSchema = z.string().trim().min(1).max(40)

/** Rubro de artículo (para lo vendido por vendedor). */
export const categoryCodeSchema = z.string().trim().min(1).max(40)

/** Lo de cada rubro en un comprobante de venta, en centavos. */
export const categoryAmountSchema = z.object({
	category: categoryCodeSchema,
	amount: centsSchema
})

/** De qué módulo vino un movimiento. `ledger` = cargado a mano acá. */
export const SOURCE_MODULES = [
	'sales',
	'purchases',
	'treasury',
	'ledger'
] as const
export const sourceModuleSchema = z.enum(SOURCE_MODULES)
export type SourceModule = z.infer<typeof sourceModuleSchema>
