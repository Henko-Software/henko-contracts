/** Claves de error propias de contacts (además de las `common.*`). */
export const CONTACTS_ERRORS = [
	'contacts.not_found',
	'contacts.system_record',
	'contacts.invalid_reference',
	'contacts.cbu_same_requester',
	'contacts.no_pending_cbu',
	'contacts.payment_term_not_found',
	'contacts.lookup_not_found',
	'contacts.lookup_code_taken'
] as const
export type ContactsErrorKey = (typeof CONTACTS_ERRORS)[number]
