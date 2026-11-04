import { z } from 'zod'

import {
	contactInfoSchema,
	recordStatusSchema
} from '@henko-software/contracts-contacts'

/**
 * Piezas comunes de las pantallas de Administración (Clientes, Proveedores,
 * Transportistas, Vendedores, Condiciones de pago, Contactos). Las arma el
 * BFF a partir de `contacts`: un cliente es un contacto con rol `customer`,
 * un proveedor uno con rol `supplier`, etc.
 *
 * Las formas copian `henko-web/apps/web/src/data/<entidad>/schema.ts`: el
 * front las usa tal cual.
 */

/**
 * «Sin asignar»: el vendedor y el transportista de sistema del front. En
 * `contacts` es `null`; el BFF traduce en los dos sentidos hasta que el
 * front se adapte (decisión 3 de `henko-web/docs/back/README.md`).
 */
export const UNASSIGNED_SALESPERSON_ID = 'sp-000001'
export const UNASSIGNED_CARRIER_ID = 'ca-000001'

/** Id de un registro: UUIDv7 de `contacts`, o el de sistema de arriba. */
export const recordIdSchema = z.string().min(1).max(60)

/**
 * Evento del historial («Actividad») como lo muestra el front. El BFF lo
 * arma con la auditoría de `contacts`: pone el nombre de quien lo hizo
 * (identity) y escribe `detail` con lo que cambió. Si lo hizo un superadmin
 * y quien mira no lo es, `user` viene vacío.
 */
export const historyEventSchema = z.object({
	id: z.string(),
	at: z.iso.datetime(),
	action: z.enum(['created', 'updated', 'deleted', 'restored', 'note']),
	user: z.string(),
	detail: z.string().nullable()
})
export type HistoryEvent = z.infer<typeof historyEventSchema>

export const historyResponseSchema = z.object({
	history: z.array(historyEventSchema)
})

/**
 * Datos de contacto como los tienen todas las fichas del front (teléfonos,
 * mail y domicilio). Lo que falta acá (sitio, número, piso, país) lo agrega
 * cada ficha si lo usa; al editar, el BFF conserva lo que la ficha no manda.
 */
export const baseContactInfoSchema = contactInfoSchema.pick({
	phone1: true,
	phone2: true,
	fax: true,
	email: true,
	address: true,
	city: true,
	province: true,
	postalCode: true
})

/** POST /api/<entidad>/status — baja o recuperación masiva, todo o nada. 204. */
export const setStatusBodySchema = z.object({
	ids: z.array(recordIdSchema).min(1).max(500),
	status: recordStatusSchema
})
export type SetStatusBody = z.infer<typeof setStatusBodySchema>

/**
 * Filtro de un listado en la query: `a,b` o `?x=a&x=b` → `['a', 'b']`.
 * Vacío o ausente = sin filtrar. Igual que en `contracts-contacts`.
 */
export const listParam = <T extends z.ZodType>(item: T) =>
	z.preprocess(value => {
		if (value === undefined || value === '') return undefined
		const values = Array.isArray(value) ? value : [value]
		return values
			.flatMap(v => (typeof v === 'string' ? v.split(',') : [v]))
			.filter(v => v !== '')
	}, z.array(item).max(100).optional())

/** `true` / `false` en la query. */
export const booleanParam = z
	.enum(['true', 'false'])
	.transform(v => v === 'true')

/** Filtro de estado común a todas las listas. */
export const statusesParam = listParam(recordStatusSchema)
