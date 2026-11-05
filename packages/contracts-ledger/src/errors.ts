/** Claves de error propias de ledger (además de las `common.*`). */
export const LEDGER_ERRORS = [
	/** Movimiento o cuenta corriente que no existe o no está al alcance. */
	'ledger.not_found',
	/** Cuenta del plan que no existe (`H-NOTFOUND` del front). */
	'ledger.chart_account_not_found',
	/** El código ya lo tiene otra cuenta, también de baja (`H-PC002`). */
	'ledger.code_taken',
	/** Mover una cuenta adentro de sí misma o de una subcuenta (`H-PC003`). */
	'ledger.move_loop',
	/** Dar de baja una cuenta con subcuentas activas (`H-PC004`). */
	'ledger.has_active_children',
	/** Dar de baja una cuenta que maneja el sistema (`H-PC005`). */
	'ledger.system_account',
	/** Mover adentro de una imputable o una caja (`H-PC006`). */
	'ledger.move_into_posting',
	/** El comprobante al que se imputa todavía no está anotado (se reintenta). */
	'ledger.document_not_found',
	/** El mismo comprobante llegó con otros datos. */
	'ledger.document_conflict',
	/** Imputación imposible: otra cuenta, mismo lado o más de lo pendiente. */
	'ledger.invalid_application',
	/** El movimiento ya tiene contra-asiento. */
	'ledger.already_reversed',
	/** Un comprobante de otro módulo se anula desde su módulo. */
	'ledger.not_manual',
	/** Un tipo de comprobante que no va de ese lado (recibo a un proveedor). */
	'ledger.wrong_party',
	/** Cuotas que no suman el importe o cuya última no vence en `dueDate`. */
	'ledger.invalid_installments'
] as const
export type LedgerErrorKey = (typeof LEDGER_ERRORS)[number]
