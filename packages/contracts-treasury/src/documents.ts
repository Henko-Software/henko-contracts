import { z } from 'zod'

import { PAYMENT_MAIL_TEMPLATES } from '@henko-software/contracts-contacts'

/**
 * El papel (PDF) y el mail de recibos y órdenes de pago. Treasury no llama a
 * otros módulos: el cliente o proveedor como va en el papel, y a qué mail se
 * manda, los trae quien llama (el BFF, de contacts). El PDF sale con
 * `content-type: application/pdf` y el nombre en `content-disposition`.
 */

export const documentPartySchema = z.object({
	name: z.string().trim().min(1).max(200),
	/** CUIT o documento. */
	taxId: z.string().trim().max(20).nullable(),
	address: z.string().trim().max(200).nullable(),
	/** A dónde va el mail (`null`: no se puede mandar). */
	email: z.email().nullable()
})
export type DocumentParty = z.infer<typeof documentPartySchema>

/**
 * `POST /internal/receipts/:id/pdf` · `POST /internal/payment-orders/:id/pdf`
 * · `POST /internal/payment-orders/:id/certificates/pdf` (los certificados de
 * retención, uno por hoja; `treasury.no_withholdings` si no tiene).
 */
export const documentPdfRequestSchema = z.object({
	party: documentPartySchema
})
export type DocumentPdfRequest = z.infer<typeof documentPdfRequestSchema>

/** `POST /internal/receipts/:id/mail` — manda el recibo en PDF al cliente (204). */
export const receiptMailRequestSchema = z.object({
	party: documentPartySchema
})
export type ReceiptMailRequest = z.infer<typeof receiptMailRequestSchema>

export const paymentMailTemplateSchema = z.enum(PAYMENT_MAIL_TEMPLATES)

/**
 * `POST /internal/payment-orders/:id/mail` — el aviso de pago al proveedor
 * (204). Con la plantilla del proveedor (contacts, `payments.mailTemplate`):
 * `payment_order` (por defecto) manda la orden y los certificados;
 * `transfer_notice`, el aviso de transferencia con la orden;
 * `withholding_certificate`, sólo los certificados.
 */
export const paymentOrderMailRequestSchema = z.object({
	party: documentPartySchema,
	template: paymentMailTemplateSchema.nullable().default(null)
})
export type PaymentOrderMailRequest = z.output<
	typeof paymentOrderMailRequestSchema
>
