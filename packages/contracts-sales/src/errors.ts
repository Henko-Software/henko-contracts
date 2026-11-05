/** Claves de error propias de sales (además de las `common.*`). */
export const SALES_ERRORS = [
	'sales.order_not_found',
	/** Editar un pedido cerrado, anulado o con algo remitido (H-PE002). */
	'sales.order_locked',
	/** Anular, cerrar o recuperar algo que no está en ese estado. */
	'sales.order_status',
	/** Un pedido que ya no está para armar (H-PE003). */
	'sales.order_not_dispatchable',
	/** Generar remitos sin que salga nada (H-PE004). */
	'sales.nothing_to_dispatch',
	'sales.route_sheet_not_found',
	'sales.delivery_note_not_found',
	'sales.invoice_not_found',
	/** Un pedido que ya no tiene nada para facturar (H-FC002). */
	'sales.nothing_to_invoice',
	/** Cliente sin condición de IVA o A con CUIT inválido (H-FC004, RG 5616). */
	'sales.receiver_not_valid',
	/** Nota de crédito que acredita más de lo que queda (H-FC003). */
	'sales.credit_exceeded',
	/** Nota sobre algo que no es una factura vigente con CAE. */
	'sales.invoice_not_creditable',
	/** Reintentar el CAE de una factura que no está pendiente. */
	'sales.invoice_not_pending',
	/** Conteo de bandejas inválido (H-PE005). */
	'sales.invalid_tray_count',
	/** Anular un remito con algo facturado o devuelto, o ya anulado. */
	'sales.delivery_note_not_voidable',
	/** Mandar por mail a un cliente sin mail de facturación. */
	'sales.no_billing_email',
	/** No se pudo mandar el mail (el servidor de correo no respondió). */
	'sales.mail_failed',
	/** Encolar el mail de un comprobante que todavía no tiene CAE (o fue rechazado). */
	'sales.invoice_not_authorized',
	'sales.return_not_found',
	/** Devolver más de lo que se puede de una línea, o una línea repetida (H-DV002). */
	'sales.return_exceeded'
] as const
export type SalesErrorKey = (typeof SALES_ERRORS)[number]
