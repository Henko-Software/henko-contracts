import { z } from 'zod'

import { absenceKindSchema } from './absences.js'
import { isoDateSchema, peopleIdSchema } from './common.js'
import { listEmployeesQuerySchema } from './employees.js'

/** Cómo está un empleado un día. `out` = todavía no entró o ya se fue. */
export const DAY_STATES = [
	'working',
	'day_off',
	'holiday',
	'vacation',
	'leave',
	'out'
] as const
export const dayStateSchema = z.enum(DAY_STATES)

export const holidaySchema = z.object({
	date: isoDateSchema,
	name: z.string().min(1).max(120)
})
export type Holiday = z.infer<typeof holidaySchema>

export const rosterDaySchema = z.object({
	date: isoDateSchema,
	state: dayStateSchema,
	note: z.string().nullable(),
	until: isoDateSchema.nullable(),
	absence: absenceKindSchema.nullable(),
	absenceId: peopleIdSchema.nullable()
})
export type RosterDay = z.infer<typeof rosterDaySchema>

export const rosterSchema = z.object({
	/** Lunes a domingo. */
	days: z.array(isoDateSchema).length(7),
	holidays: z.array(holidaySchema),
	rows: z.array(
		z.object({
			employeeId: peopleIdSchema,
			days: z.array(rosterDaySchema).length(7)
		})
	)
})
export type Roster = z.infer<typeof rosterSchema>

/** GET /internal/employees/roster?week=2026-10-19&… (mismos filtros que la lista). */
export const rosterQuerySchema = listEmployeesQuerySchema.extend({
	/** El lunes de la semana; si no es lunes, el lunes de esa semana. */
	week: isoDateSchema
})
export const rosterResponseSchema = z.object({ roster: rosterSchema })
