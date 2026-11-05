import { z } from 'zod'

import { contactRoleSchema } from './contacts.js'

/** Claves de error propias de contacts (además de las `common.*`). */
export const CONTACTS_ERRORS = [
	'contacts.not_found',
	'contacts.system_record',
	'contacts.invalid_reference',
	'contacts.cbu_same_requester',
	'contacts.no_pending_cbu',
	'contacts.payment_term_not_found',
	'contacts.lookup_not_found',
	'contacts.lookup_code_taken',
	'contacts.doc_taken'
] as const
export type ContactsErrorKey = (typeof CONTACTS_ERRORS)[number]

/**
 * `details` de `contacts.doc_taken` (409): el alta o la edición traen un CUIT
 * o CUIL que ya tiene otro contacto activo. Decisión asumida 18 (ronda
 * 2026-11-05): no se duplica; el front avisa y ofrece abrir el existente.
 * `existing` es `null` si el que lo tiene está fuera del alcance de quien
 * pide (otro local): se avisa sin mostrarlo.
 */
export const docTakenDetailsSchema = z.object({
	fields: z.object({ docNumber: z.string() }),
	existing: z
		.object({
			id: z.uuid(),
			name: z.string(),
			roles: z.array(contactRoleSchema)
		})
		.nullable()
})
export type DocTakenDetails = z.infer<typeof docTakenDetailsSchema>
