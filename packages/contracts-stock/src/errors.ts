/** Claves de error propias de stock (además de las `common.*`). */
export const STOCK_ERRORS = [
	'stock.location_not_found',
	'stock.count_not_found',
	'stock.operation_not_found',
	/** Sale más de lo que hay en esa ubicación o lote (front `H-ST002`). */
	'stock.insufficient',
	/** El conteo ya no está en curso (front `H-CO003`). */
	'stock.count_not_open',
	/** Una ubicación con stock no se archiva. */
	'stock.location_not_empty',
	/** No se mueve nada a una ubicación archivada. */
	'stock.location_archived',
	/** La operación ya se anuló o la anula su propio módulo (remito, recepción). */
	'stock.not_voidable',
	/** El mismo id de operación con otro contenido. */
	'stock.operation_conflict',
	/** Escribir sobre una versión vieja del registro. */
	'stock.version_conflict'
] as const
export type StockErrorKey = (typeof STOCK_ERRORS)[number]
