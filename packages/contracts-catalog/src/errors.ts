/** Claves de error propias de catalog (además de las `common.*`). */
export const CATALOG_ERRORS = [
	'catalog.article_not_found',
	'catalog.article_group_not_found',
	'catalog.price_list_not_found',
	'catalog.price_not_found',
	/** El cambio no existe o ya se deshizo (en el front, `H-PR002`). */
	'catalog.price_change_not_found',
	'catalog.discount_scale_not_found',
	/** Ya hay un agrupamiento o una lista con ese nombre. */
	'catalog.name_taken',
	/** Algo apunta a lo que no existe (agrupamiento, componente, presentación). */
	'catalog.invalid_reference'
] as const
export type CatalogErrorKey = (typeof CATALOG_ERRORS)[number]
