/** Claves de error propias de production (además de las `common.*`). */
export const PRODUCTION_ERRORS = [
	'production.order_not_found',
	/** Un artículo que no es un elaborado activo con datos de producción (H-NOTFOUND). */
	'production.article_not_producible',
	/** La orden no está abierta (H-PD003). */
	'production.order_not_open',
	/** Un lote elegido no tiene lo que se usó (H-PD002). */
	'production.lot_short',
	/** No hay ubicación donde guardar lo producido o lo retenido. */
	'production.location_missing',
	/** El lote no aparece en los movimientos (H-NOTFOUND). */
	'production.lot_not_found',
	'production.recall_not_found',
	/** Ese lote ya tiene un retiro o simulacro en curso (H-TR002). */
	'production.recall_in_progress',
	/** El retiro o simulacro ya terminó (H-TR003). */
	'production.recall_closed',
	/** El local no está en la lista del retiro. */
	'production.recall_store_unknown'
] as const
export type ProductionErrorKey = (typeof PRODUCTION_ERRORS)[number]
