import { z } from 'zod'

import { absenceKindSchema } from './absences.js'
import { alertKindSchema, paperStateSchema } from './alerts.js'
import { isoDateSchema, peopleIdSchema, recordStatusSchema } from './common.js'
import {
	employeePaperSchema,
	exitReasonSchema,
	workplaceKindSchema
} from './employees.js'

/**
 * Eventos de people (stream `PEOPLE`, por el outbox, con el id en
 * `Nats-Msg-Id`). **No llevan datos sensibles** (documento, nacimiento,
 * salud, contacto): el empleado viaja por id, código, legajo y lugar de
 * trabajo. Quien necesite más lo pide por la API, con permiso.
 */
export const PEOPLE_EVENTS = {
	employeeCreated: 'people.employee.created.v1',
	employeeUpdated: 'people.employee.updated.v1',
	employeesStatusChanged: 'people.employees.status_changed.v1',
	employeeExitSet: 'people.employee.exit_set.v1',
	absenceCreated: 'people.absence.created.v1',
	absenceUpdated: 'people.absence.updated.v1',
	absenceDeleted: 'people.absence.deleted.v1',
	alertRaised: 'people.alert.raised.v1'
} as const

export const employeeRefSchema = z.object({
	id: peopleIdSchema,
	code: z.string(),
	fileNumber: z.string(),
	workplace: z.object({
		kind: workplaceKindSchema,
		storeId: z.string().nullable()
	})
})
export type EmployeeRef = z.infer<typeof employeeRefSchema>

/** `people.employee.created.v1` · `people.employee.updated.v1` */
export const employeeChangedEventSchema = z.object({
	employee: employeeRefSchema
})

/** `people.employees.status_changed.v1`: baja o recuperación masiva. */
export const employeesStatusChangedEventSchema = z.object({
	ids: z.array(peopleIdSchema).min(1),
	status: recordStatusSchema
})

/** `people.employee.exit_set.v1`: se cargó, cambió o sacó el egreso. */
export const employeeExitSetEventSchema = z.object({
	employee: employeeRefSchema,
	exit: z.object({ date: isoDateSchema, reason: exitReasonSchema }).nullable()
})

/**
 * `people.absence.*.v1`: sin la nota (puede decir algo de salud). Una
 * licencia por enfermedad viaja como `sick` sin más.
 */
export const absenceChangedEventSchema = z.object({
	absence: z.object({
		id: peopleIdSchema,
		employeeId: peopleIdSchema,
		kind: absenceKindSchema,
		from: isoDateSchema,
		to: isoDateSchema
	})
})

/**
 * `people.alert.raised.v1`: un papel que vence en 30 días o venció, o el
 * fin del período de prueba que se acerca. Sale una vez por empleado, papel
 * y vencimiento (lo arma el proceso diario de people).
 */
export const alertRaisedEventSchema = z.object({
	employee: employeeRefSchema,
	kind: alertKindSchema.extract(['paper', 'probation']),
	paper: employeePaperSchema.nullable(),
	paperState: paperStateSchema.nullable(),
	date: isoDateSchema.nullable()
})
export type AlertRaisedEvent = z.infer<typeof alertRaisedEventSchema>
