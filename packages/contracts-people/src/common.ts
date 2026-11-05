import { z } from 'zod'

import {
	airesCodeSchema,
	cuitSchema,
	isoDateSchema,
	lookupCodeSchema,
	provinceSchema,
	recordStatusSchema
} from '@henko-software/contracts-contacts'

export {
	airesCodeSchema,
	cuitSchema,
	isoDateSchema,
	lookupCodeSchema,
	provinceSchema,
	recordStatusSchema
}

/**
 * Piezas comunes del contrato de people. Las formas copian
 * `henko-web/apps/web/src/data/employees/schema.ts` y `rules.ts`: mismos
 * nombres, campos siempre presentes con `null`, enums en inglés. Fechas
 * `YYYY-MM-DD`; instantes ISO en UTC.
 */

/** Id de algo que guarda people (UUIDv7). */
export const peopleIdSchema = z.uuid()

/**
 * Quién hizo algo. Si lo hizo un superadmin y quien mira no lo es, viene
 * `hidden: true` y sin id ni rol: el dato queda, lo que se esconde es quién.
 * El nombre lo pone el BFF.
 */
export const actorRefSchema = z.object({
	origin: z.enum(['person', 'automatic']),
	id: z.string().nullable(),
	role: z.string().nullable(),
	label: z.string().nullable(),
	hidden: z.boolean()
})
export type ActorRef = z.infer<typeof actorRefSchema>

/** Entrada del historial («Actividad») de una ficha, con el cambio ya legible. */
export const historyEntrySchema = z.object({
	id: z.uuid(),
	at: z.iso.datetime(),
	/** Clave del catálogo de auditoría (`people.employee.updated`). */
	action: z.string(),
	actionLabel: z.string(),
	kind: z.enum(['created', 'updated', 'deleted', 'restored', 'note']),
	/** «Ingreso con legajo 0042», «Categoría: Encargado → Maestro Heladero». */
	detail: z.string().nullable(),
	actor: actorRefSchema
})
export type HistoryEntry = z.infer<typeof historyEntrySchema>

/**
 * Teléfonos, mail y domicilio de un empleado: el `ContactInfo` del front
 * (`data/shared`), no el de contacts (que suma web, piso y país).
 */
export const employeeContactSchema = z.object({
	phone1: z.string().max(40).nullable(),
	phone2: z.string().max(40).nullable(),
	fax: z.string().max(40).nullable(),
	email: z.email().nullable(),
	address: z.string().max(120).nullable(),
	city: z.string().max(80).nullable(),
	province: provinceSchema.nullable(),
	postalCode: z.string().max(10).nullable()
})
export type EmployeeContact = z.infer<typeof employeeContactSchema>
