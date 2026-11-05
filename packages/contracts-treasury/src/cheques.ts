import { z } from 'zod'

import {
	contactIdSchema,
	documentNumberSchema,
	idsSchema,
	isoDateSchema,
	listParam,
	positiveCentsSchema,
	treasuryIdSchema
} from './common.js'

/**
 * Cartera de cheques y e-cheq de clientes (Aires: Valores recibidos y
 * Chequera de valores). Entran con un recibo y quedan en la cartera hasta
 * que se depositan o se endosan. Forma de
 * `henko-web/apps/web/src/data/cheques/schema.ts`.
 *
 * `in_portfolio` → `deposited` → `credited`, o `in_portfolio` → `endorsed`.
 * `deposited` y `endorsed` pueden pasar a `rejected`: la deuda del cliente
 * vuelve a abrirse con una nota de débito (`treasury.cheque.rejected.v1`);
 * si estaba endosado, también vuelve la deuda con el proveedor
 * (`treasury.cheque.returned.v1`).
 */

export const CHEQUE_STATUSES = [
	'in_portfolio',
	'deposited',
	'credited',
	'endorsed',
	'rejected'
] as const
export const chequeStatusSchema = z.enum(CHEQUE_STATUSES)
export type ChequeStatus = z.infer<typeof chequeStatusSchema>

/** Cuántos días hay para presentar un cheque desde su fecha de pago (Ley 24.452, art. 25). */
export const PRESENTATION_DAYS = 30

export const chequeSchema = z.object({
	id: treasuryIdSchema,
	kind: z.enum(['echeq', 'cheque']),
	bank: z.string(),
	number: z.string(),
	payDate: isoDateSchema,
	amount: positiveCentsSchema,
	customerId: contactIdSchema,
	localId: z.string().nullable(),
	receiptId: treasuryIdSchema,
	receiptNumber: documentNumberSchema,
	receivedAt: isoDateSchema,
	status: chequeStatusSchema,
	depositedTo: treasuryIdSchema.nullable(),
	depositedAt: isoDateSchema.nullable(),
	creditedAt: isoDateSchema.nullable(),
	endorsedTo: contactIdSchema.nullable(),
	endorsedAt: isoDateSchema.nullable(),
	/** La orden de pago con que se endosó (si fue por una). */
	paymentOrderId: treasuryIdSchema.nullable(),
	rejectedAt: isoDateSchema.nullable(),
	rejectReason: z.string().max(120).nullable()
})
export type Cheque = z.infer<typeof chequeSchema>

/** Un paso del recorrido: el BFF arma el detalle legible con los nombres. */
export const chequeStepSchema = z.object({
	status: chequeStatusSchema,
	date: isoDateSchema,
	bankAccountId: treasuryIdSchema.nullable(),
	supplierId: contactIdSchema.nullable(),
	reason: z.string().nullable()
})
export type ChequeStep = z.infer<typeof chequeStepSchema>

/** `GET /internal/cheques` — lo que se cobra primero, primero. */
export const listChequesQuerySchema = z.object({
	query: z.string().trim().max(80).optional(),
	statuses: listParam(chequeStatusSchema),
	customerIds: listParam(contactIdSchema),
	depositedTo: listParam(treasuryIdSchema),
	limit: z.coerce.number().int().min(1).max(2000).default(1000)
})
export type ListChequesQuery = z.output<typeof listChequesQuerySchema>
export const listChequesResponseSchema = z.object({
	cheques: z.array(chequeSchema)
})
export const chequeDetailResponseSchema = z.object({
	cheque: chequeSchema,
	history: z.array(chequeStepSchema)
})

/** `POST /internal/cheques/deposit` — todo o nada. */
export const depositChequesRequestSchema = z.object({
	ids: idsSchema,
	bankAccountId: treasuryIdSchema,
	date: isoDateSchema
})
/** `POST /internal/cheques/credit` */
export const creditChequesRequestSchema = z.object({
	ids: idsSchema,
	date: isoDateSchema
})
/** `POST /internal/cheques/endorse` */
export const endorseChequesRequestSchema = z.object({
	ids: idsSchema,
	supplierId: contactIdSchema,
	date: isoDateSchema
})
/** `POST /internal/cheques/:id/reject` */
export const rejectChequeRequestSchema = z.object({
	reason: z.string().trim().min(1).max(120),
	date: isoDateSchema
})
