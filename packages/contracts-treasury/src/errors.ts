/** Claves de error propias de treasury (además de las `common.*`). */
export const TREASURY_ERRORS = [
	'treasury.receipt_not_found',
	'treasury.payment_order_not_found',
	'treasury.cheque_not_found',
	'treasury.bank_account_not_found',
	'treasury.statement_line_not_found',
	'treasury.cash_entry_not_found',
	/** Una factura ya no debe lo que se le aplica en el recibo (H-RC002). */
	'treasury.receipt_application_exceeds',
	/** Una factura ya no debe lo que se le aplica en la orden (H-OP002). */
	'treasury.payment_application_exceeds',
	/** Un cheque que no está en el estado que pide la operación (H-CH002). */
	'treasury.cheque_not_available',
	/** Un movimiento del extracto que ya no está por revisar (H-BS002). */
	'treasury.statement_line_not_pending',
	/** La cuenta no sirve para eso (dada de baja, en dólares, no acepta cheques). */
	'treasury.bank_account_not_usable',
	/** Código de cuenta bancaria repetido. */
	'treasury.bank_account_code_taken',
	/** CBU repetido: es la misma cuenta cargada dos veces. */
	'treasury.bank_account_cbu_taken',
	/** Anular algo ya anulado, o con cheques que ya no están donde estaban. */
	'treasury.not_voidable',
	/** Escribir sobre una versión vieja del registro. */
	'treasury.version_conflict'
] as const
export type TreasuryErrorKey = (typeof TREASURY_ERRORS)[number]
