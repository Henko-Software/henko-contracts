import { z } from 'zod'

import { bankAccountSchema } from './bankAccounts.js'
import { chequeStatusSchema } from './cheques.js'
import { isoDateSchema, treasuryIdSchema } from './common.js'

/**
 * Eventos de treasury (stream `TREASURY`, por el outbox, con el id en
 * `Nats-Msg-Id`). Lo que va a la cuenta corriente sale con los schemas de
 * `@henko-software/contracts-ledger` (`LEDGER_INBOUND_EVENTS`): recibos y
 * órdenes de pago emitidos o anulados, y las notas de débito de un cheque
 * rechazado (al cliente) o devuelto por el proveedor al que se endosó.
 */
export const TREASURY_EVENTS = {
	receiptIssued: 'treasury.receipt.issued.v1',
	receiptVoided: 'treasury.receipt.voided.v1',
	paymentOrderIssued: 'treasury.payment_order.issued.v1',
	paymentOrderVoided: 'treasury.payment_order.voided.v1',
	chequeRejected: 'treasury.cheque.rejected.v1',
	chequeReturned: 'treasury.cheque.returned.v1',
	chequeStatusChanged: 'treasury.cheque.status_changed.v1',
	bankAccountChanged: 'treasury.bank_account.changed.v1'
} as const

/** `treasury.cheque.status_changed.v1` — depositado, acreditado, endosado o rechazado. */
export const chequeStatusChangedEventSchema = z.object({
	cheque: z.object({
		id: treasuryIdSchema,
		status: chequeStatusSchema,
		date: isoDateSchema,
		amount: z.number().int().positive()
	})
})

/** `treasury.bank_account.changed.v1` — alta, edición, baja o recuperación: la cuenta como quedó. */
export const bankAccountChangedEventSchema = z.object({
	account: bankAccountSchema
})
