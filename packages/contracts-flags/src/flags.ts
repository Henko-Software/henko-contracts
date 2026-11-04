import { z } from 'zod'

/**
 * Feature flags de Henko. Las claves **copian la nav** de `henko-web`
 * (`apps/web/src/config/nav.ts`): un lugar del menú es una sección
 * (`orders`) y cada pantalla adentro, una subsección (`orders.returns`).
 * Hasta tres niveles (`orders.returns.export` para una acción o un bloque).
 * Una clave que no está acá no compila, ni en el front ni en los módulos.
 *
 * Cómo se resuelven (ver `estandares/flags-y-ver-como.md`):
 * - Valor propio por nodo: `default (código) < env < base`. Una raíz sin
 *   valor está apagada.
 * - Un hijo sin valor propio hereda del padre; un padre apagado apaga a los
 *   hijos aunque digan `true`.
 * - Para el superadmin (real, sin «ver como») todo da `true`. Lo resuelve el
 *   BFF una vez por request y lo manda a los módulos en el token interno.
 * - Son por instancia. No son permisos.
 */

export const FLAG_KEYS = [
	'orders',
	'orders.salesOrders',
	'orders.expedition',
	'orders.deliveryNotes',
	'orders.invoices',
	'orders.returns',
	'orders.trays',
	'orders.temperatureLogs',
	'customers',
	'openings',
	'openings.evaluate',
	'openings.places',
	'products',
	'products.articles',
	'products.priceLists',
	'products.discountScales',
	'products.bonuses',
	'purchases',
	'purchases.orders',
	'purchases.receptions',
	'purchases.suppliers',
	'purchases.invoices',
	'purchases.prices',
	'production',
	'production.plan',
	'production.stock',
	'production.counts',
	'production.traceability',
	'treasury',
	'treasury.receipts',
	'treasury.cheques',
	'treasury.payments',
	'treasury.bankAccounts',
	'treasury.cashPlan',
	'reports',
	'reports.dashboard',
	'reports.network',
	'reports.sales',
	'reports.incomeStatement',
	'reports.accounting',
	'team',
	'team.employees',
	'team.salespeople',
	'team.carriers',
	'team.payroll',
	'settings',
	'settings.paymentTerms',
	'settings.chartOfAccounts',
	'settings.articleGroups',
	'contacts'
] as const

export const flagKeySchema = z.enum(FLAG_KEYS)
export type FlagKey = z.infer<typeof flagKeySchema>

export type FlagDefinition = {
	/** La sección de la que cuelga; `null` en una raíz. */
	parent: FlagKey | null
	/** Como se ve en el panel y en la nav. */
	name: string
	/** Qué prende o apaga, en una línea. */
	description: string
}

const section = (name: string, description: string): FlagDefinition => ({
	parent: null,
	name,
	description
})
const screen = (
	parent: FlagKey,
	name: string,
	description: string
): FlagDefinition => ({ parent, name, description })

/** El catálogo: clave → padre, nombre y descripción. */
export const FLAG_CATALOG: Record<FlagKey, FlagDefinition> = {
	orders: section('Pedidos', 'Del pedido a la factura de los locales.'),
	'orders.salesOrders': screen('orders', 'Pedidos', 'Lo que pide cada local.'),
	'orders.expedition': screen(
		'orders',
		'Expedición',
		'Armado y salida de los pedidos.'
	),
	'orders.deliveryNotes': screen('orders', 'Remitos', 'Remitos de entrega.'),
	'orders.invoices': screen('orders', 'Facturas', 'Facturas de venta.'),
	'orders.returns': screen('orders', 'Devoluciones', 'Lo que vuelve.'),
	'orders.trays': screen('orders', 'Bandejas', 'Bandejas que van y vuelven.'),
	'orders.temperatureLogs': screen(
		'orders',
		'Registros de temperatura',
		'Temperatura de la cadena de frío.'
	),
	customers: section('Clientes', 'Los clientes de la central.'),
	openings: section('Aperturas', 'Dónde abrir un local nuevo.'),
	'openings.evaluate': screen(
		'openings',
		'Evaluar una esquina',
		'Si una esquina sirve para abrir.'
	),
	'openings.places': screen('openings', 'Lugares', 'Lugares guardados.'),
	products: section('Productos', 'Catálogo, listas y bonificaciones.'),
	'products.articles': screen('products', 'Artículos', 'El catálogo.'),
	'products.priceLists': screen(
		'products',
		'Listas de precios',
		'Precios de venta.'
	),
	'products.discountScales': screen(
		'products',
		'Bonificaciones',
		'Escalas de bonificación.'
	),
	'products.bonuses': screen(
		'products',
		'Bonificaciones por factura',
		'Bonificaciones por factura.'
	),
	purchases: section('Compras', 'A quién le compra la central.'),
	'purchases.orders': screen(
		'purchases',
		'Compras',
		'Pedido, recepción, factura y pago.'
	),
	'purchases.receptions': screen(
		'purchases',
		'Recepciones',
		'Lo que llega de los proveedores.'
	),
	'purchases.suppliers': screen('purchases', 'Proveedores', 'Los proveedores.'),
	'purchases.invoices': screen(
		'purchases',
		'Facturas de compra',
		'Facturas de los proveedores.'
	),
	'purchases.prices': screen(
		'purchases',
		'Precios de insumos',
		'Lo que cuesta cada insumo.'
	),
	production: section('Producción y stock', 'Cocina, stock y conteos.'),
	'production.plan': screen(
		'production',
		'Producción',
		'Qué producir y el cierre de cada orden.'
	),
	'production.stock': screen('production', 'Stock', 'Lo que hay.'),
	'production.counts': screen('production', 'Conteos', 'Conteos de stock.'),
	'production.traceability': screen(
		'production',
		'Trazabilidad',
		'De dónde viene cada lote.'
	),
	treasury: section('Tesorería', 'Cobranzas, pagos y bancos.'),
	'treasury.receipts': screen('treasury', 'Cobranzas', 'Lo que se cobra.'),
	'treasury.cheques': screen('treasury', 'Cheques', 'Cheques en cartera.'),
	'treasury.payments': screen('treasury', 'Pagos', 'Lo que se paga.'),
	'treasury.bankAccounts': screen(
		'treasury',
		'Cuentas bancarias',
		'Las cuentas de la central.'
	),
	'treasury.cashPlan': screen(
		'treasury',
		'Caja proyectada',
		'La caja de las próximas semanas.'
	),
	reports: section('Reportes', 'Tablero y reportes.'),
	'reports.dashboard': screen('reports', 'Tablero', 'Los números del día.'),
	'reports.network': screen(
		'reports',
		'Red de franquicias',
		'Cómo va cada local.'
	),
	'reports.sales': screen('reports', 'Ventas', 'Reporte de ventas.'),
	'reports.incomeStatement': screen(
		'reports',
		'Rubros de resultados',
		'Rubros del estado de resultados.'
	),
	'reports.accounting': screen('reports', 'Contaduría', 'Contabilidad.'),
	team: section('Equipo', 'Las personas de la central.'),
	'team.employees': screen('team', 'Empleados', 'Empleados de la central.'),
	'team.salespeople': screen('team', 'Vendedores', 'Vendedores.'),
	'team.carriers': screen('team', 'Transportistas', 'Quienes reparten.'),
	'team.payroll': screen('team', 'Sueldos', 'Liquidación de sueldos.'),
	settings: section('Configuración', 'Lo que se carga una vez.'),
	'settings.paymentTerms': screen(
		'settings',
		'Condiciones de pago',
		'Plazos de pago.'
	),
	'settings.chartOfAccounts': screen(
		'settings',
		'Plan de cuentas',
		'El plan de cuentas.'
	),
	'settings.articleGroups': screen(
		'settings',
		'Agrupamientos',
		'Grupos de artículos.'
	),
	contacts: section('Contactos', 'Agenda de contactos.')
}

/** Valores propios guardados (una capa): la clave que falta hereda. */
export const flagValuesSchema = z.partialRecord(flagKeySchema, z.boolean())
export type FlagValues = z.infer<typeof flagValuesSchema>

/** Valores efectivos de una persona: todas las claves, ya resueltas. */
export const effectiveFlagsSchema = z.record(flagKeySchema, z.boolean())
export type EffectiveFlags = z.infer<typeof effectiveFlagsSchema>

/** De dónde sale el valor de un nodo. */
export const flagSourceSchema = z.enum(['base', 'env', 'default', 'inherited'])

/** Un nodo del panel de flags (sólo superadmin). */
export const flagNodeSchema = z.object({
	key: flagKeySchema,
	parent: flagKeySchema.nullable(),
	name: z.string(),
	description: z.string(),
	/** Valor propio ganador, o `null` si hereda del padre. */
	value: z.boolean().nullable(),
	source: flagSourceSchema,
	/** Lo que ven los usuarios (sin el bypass del superadmin). */
	enabled: z.boolean(),
	/** Lo guardado en la base (lo que se cambia desde el panel), o `null`. */
	stored: z.boolean().nullable()
})
export type FlagNode = z.infer<typeof flagNodeSchema>

/** Prender, apagar o volver a heredar (`null`) un nodo. */
export const setFlagRequestSchema = z.object({
	enabled: z.boolean().nullable()
})
export type SetFlagRequest = z.infer<typeof setFlagRequestSchema>
