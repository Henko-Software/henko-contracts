/** Claves de error propias de network (además de las `common.*`). */
export const NETWORK_ERRORS = [
	'network.site_not_found',
	/** Esa dirección ya está guardada como lugar. */
	'network.site_exists',
	/** Un lugar descartado sólo se mueve para volver a abrirlo («Para mirar»). */
	'network.site_discarded',
	'network.store_not_found',
	/** Ese cliente ya tiene un local en la red. */
	'network.store_exists',
	/** La dirección no la buscó nadie: no sabemos dónde queda. */
	'network.address_not_found',
	/** El geocodificador o el mapa no respondieron. */
	'network.provider_unavailable'
] as const
export type NetworkErrorKey = (typeof NETWORK_ERRORS)[number]
