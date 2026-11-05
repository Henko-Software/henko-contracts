import { z } from 'zod'

import { isoDateSchema } from '@henko-software/contracts-contacts'

/**
 * El comprobante de cuenta corriente, uno solo para clientes y proveedores
 * (decisión asumida 8: propuesta del front en `docs/back/suppliers.md`, con
 * la forma de `SupplierMovement`). Lo arma el BFF con lo que da `ledger`.
 * Cada lado acota los tipos (un cliente tiene recibos; un proveedor,
 * órdenes de pago) y el número (el front de clientes pide punto de venta de
 * 4 dígitos). Saldos iniciales, ajustes y contra-asientos llegan como nota
 * de débito o de crédito según el signo.
 */

/** Una cuota del comprobante (decisión asumida 13). */
export const ledgerInstallmentSchema = z.object({
	dueDate: isoDateSchema,
	/** En centavos, en pesos. */
	amount: z.number().int().min(0)
})

/** La razón social de la casa central (`GET /api/companies`). */
export const companyIdParamSchema = z.string().min(1).max(40)

export const ledgerMovementSchemaFor = <
	const K extends readonly [string, ...string[]]
>(
	kinds: K,
	number: z.ZodString
) => {
	const kindSchema = z.enum(kinds)
	return z.object({
		id: z.string(),
		date: isoDateSchema,
		kind: kindSchema,
		/** Letra de la factura o nota; las OP, recibos y ajustes no tienen. */
		letter: z.enum(['A', 'B', 'C', 'M', 'X']).nullable(),
		number,
		/** Qué se compró, vendió o pagó, en una línea. */
		description: z.string().max(120).nullable(),
		/** El último vencimiento (con cuotas, el de la última). */
		dueDate: isoDateSchema.nullable(),
		/** Las cuotas; vacío = una sola, `dueDate`. */
		installments: z.array(ledgerInstallmentSchema),
		/** La razón social que lo emitió o recibió (la de por defecto si no dice). */
		company: companyIdParamSchema,
		currency: z.enum(['ARS', 'USD']),
		/** Cotización a pesos del día del comprobante (1 en pesos). */
		exchangeRate: z.number().positive(),
		/** El importe en la moneda del comprobante, en centavos. */
		originalAmount: z.number().int(),
		/** En pesos: positivo suma deuda, negativo la baja. */
		amount: z.number().int(),
		/** Lo ya imputado (neto), en centavos. */
		applied: z.number().int().min(0),
		/** Lo que falta imputar. 0 = cancelado. */
		pending: z.number().int().min(0),
		settled: z.boolean(),
		/** Qué comprobante canceló a cuál (Aires: grilla «Aplicaciones»). */
		applications: z.array(
			z.object({
				id: z.string(),
				date: isoDateSchema,
				kind: kindSchema,
				number,
				amount: z.number().int().min(0)
			})
		)
	})
}

/** Una razón social de la instancia (Aires: «Empresa»). */
export const companySchema = z.object({
	id: companyIdParamSchema,
	/** El número de empresa de Aires (`1`, `2`). */
	code: z.string(),
	name: z.string(),
	isDefault: z.boolean()
})
export type Company = z.infer<typeof companySchema>

/**
 * GET /api/companies — las razones sociales de la instancia, la de por
 * defecto primero (decisión asumida 7). Es dato de la instancia: no mira
 * flags (lo usan Clientes, Proveedores, Compras y Tesorería).
 */
export const listCompaniesResponseSchema = z.object({
	companies: z.array(companySchema)
})
