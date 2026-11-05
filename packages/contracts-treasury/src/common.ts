import { z } from 'zod'

export { booleanParam, listParam } from '@henko-software/contracts-common'
export { isoDateSchema } from '@henko-software/contracts-contacts'

/**
 * Piezas comunes del contrato de treasury. Las formas copian
 * `henko-web/apps/web/src/data/{receipts,payment_orders,cheques,bank_accounts,bank_statements,cash_plan}/schema.ts`:
 * mismos nombres, campos siempre presentes con `null`, enums en inglés.
 * Plata en centavos enteros; fechas `YYYY-MM-DD`; instantes ISO en UTC.
 */

/** Id de algo que guarda treasury (UUIDv7). */
export const treasuryIdSchema = z.uuid()

/** Id de un contacto (cliente o proveedor) de `contacts`. */
export const contactIdSchema = z.uuid()

/** Punto de venta y número: `0001-00004872`. */
export const documentNumberSchema = z.string().regex(/^\d{4}-\d{8}$/)

/** Centavos enteros mayores que cero. */
export const positiveCentsSchema = z
	.number()
	.int()
	.positive()
	.refine(Number.isSafeInteger, { message: 'Fuera de rango' })

/** Centavos enteros con signo. */
export const centsSchema = z
	.number()
	.int()
	.refine(Number.isSafeInteger, { message: 'Fuera de rango' })

export const CURRENCIES = ['ARS', 'USD'] as const
export const currencySchema = z.enum(CURRENCIES)
export type Currency = z.infer<typeof currencySchema>

/**
 * Quién hizo algo. Si lo hizo un superadmin y quien mira no lo es, viene
 * `hidden: true` y sin id ni rol: el dato queda, lo que se esconde es quién.
 * El nombre lo pone el BFF.
 */
export const actorRefSchema = z.object({
	origin: z.enum(['person', 'automatic']),
	id: z.string().nullable(),
	role: z.string().nullable(),
	label: z.string().nullable(),
	hidden: z.boolean()
})
export type ActorRef = z.infer<typeof actorRefSchema>

/** Entrada del historial («Actividad») de una ficha. */
export const historyEntrySchema = z.object({
	id: z.uuid(),
	at: z.iso.datetime(),
	/** Clave del catálogo de auditoría (`treasury.receipt.created`). */
	action: z.string(),
	actionLabel: z.string(),
	kind: z.enum(['created', 'updated', 'deleted', 'restored', 'note']),
	detail: z.string().nullable(),
	actor: actorRefSchema
})
export type HistoryEntry = z.infer<typeof historyEntrySchema>

/** Ids de a varios (todo o nada). */
export const idsSchema = z.array(treasuryIdSchema).min(1).max(500)

/**
 * Lo que queda por cancelar de una factura o nota de débito al momento de
 * registrar, como lo dice `ledger` (`GET /internal/open-items`, sin `net`).
 * Lo trae quien llama (el BFF): treasury no llama a otros módulos.
 */
export const openItemRefSchema = z.object({
	movementId: z.uuid(),
	pending: positiveCentsSchema
})
export type OpenItemRef = z.infer<typeof openItemRefSchema>

/** Qué parte de un recibo u orden cancela cada comprobante de la cuenta corriente. */
export const applicationSchema = z.object({
	/** El movimiento de `ledger` (factura o nota de débito). */
	movementId: z.uuid(),
	/** Para mostrarlo sin buscarlo: «0003-00012845». */
	number: z.string().trim().min(1).max(40),
	amount: positiveCentsSchema
})
export type Application = z.infer<typeof applicationSchema>

/** Cheque o e-cheq: sólo números, de 4 a 12. */
export const chequeNumberSchema = z
	.string()
	.regex(/^\d{4,12}$/, 'Sólo números, de 4 a 12.')

/** Anular un recibo o una orden: contra-asiento en la cuenta corriente. */
export const voidRequestSchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	reason: z.string().trim().min(1).max(120)
})
export type VoidRequest = z.infer<typeof voidRequestSchema>

/** Lo que se vuelve a mostrar de un comprobante anulado. */
export const voidedSchema = z
	.object({
		date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
		reason: z.string().max(120)
	})
	.nullable()

/** `GET …/next-number` */
export const nextNumberResponseSchema = z.object({
	number: documentNumberSchema
})
