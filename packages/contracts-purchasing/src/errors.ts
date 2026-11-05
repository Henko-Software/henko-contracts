/** Claves de error propias de purchasing (además de las `common.*`). */
export const PURCHASING_ERRORS = [
	'purchasing.order_not_found',
	/** Editar un pedido anulado o con algo recibido. */
	'purchasing.order_locked',
	/** Anular un pedido con algo recibido (H-OC002): lo recibido se devuelve. */
	'purchasing.order_not_cancellable',
	'purchasing.reception_not_found',
	/** Recibir sobre un pedido anulado o facturado (H-RE002). */
	'purchasing.order_not_receivable',
	/** Aceptar más de lo que falta, con la tolerancia (H-RE002). */
	'purchasing.reception_exceeds',
	/** Un insumo que no está en el pedido o un proveedor que no es el del pedido. */
	'purchasing.reception_mismatch',
	/** Anular una recepción ya facturada o anulada. */
	'purchasing.reception_not_voidable',
	'purchasing.invoice_not_found',
	/** Esa factura ya está cargada: proveedor, letra y número (H-FP002). */
	'purchasing.invoice_duplicate',
	/** El pedido está anulado o no tiene nada recibido sin facturar (H-FP003). */
	'purchasing.nothing_to_invoice',
	/** La factura ya no espera nota de crédito (H-FP004). */
	'purchasing.claim_not_open',
	/** Anular una factura ya anulada. */
	'purchasing.invoice_not_voidable'
] as const
export type PurchasingErrorKey = (typeof PURCHASING_ERRORS)[number]
