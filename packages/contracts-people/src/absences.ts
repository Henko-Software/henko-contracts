import { z } from 'zod'

import { isoDateSchema, peopleIdSchema } from './common.js'

/**
 * Ausencias: vacaciones y licencias de la LCT (art. 158). Copia
 * `henko-web/apps/web/src/data/employees/schema.ts`.
 */
export const ABSENCE_KINDS = [
	'vacation',
	'sick',
	'exam',
	'marriage',
	'birth',
	'bereavement',
	'bereavement_sibling',
	'other'
] as const
export const absenceKindSchema = z.enum(ABSENCE_KINDS)
export type AbsenceKind = z.infer<typeof absenceKindSchema>

const absenceFields = {
	employeeId: peopleIdSchema,
	kind: absenceKindSchema,
	from: isoDateSchema,
	/** Último día, inclusive. */
	to: isoDateSchema,
	/** «Gripe, con certificado», «Final de Química». */
	note: z.string().max(200).nullable()
}

export const absenceSchema = z.object({ id: peopleIdSchema, ...absenceFields })
export type Absence = z.infer<typeof absenceSchema>

export const absenceInputSchema = z
	.object(absenceFields)
	.refine(absence => absence.to >= absence.from, {
		path: ['to'],
		message: 'Termina antes de empezar'
	})
export type AbsenceInput = z.infer<typeof absenceInputSchema>

/**
 * Lo que avisa y deja guardar (la ley o el convenio pueden tener
 * excepciones): tramo de vacaciones corto, poco preaviso, más que el saldo,
 * tope de exámenes y vacaciones que no empiezan un lunes.
 */
export const absenceWarningSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('shortVacation') }),
	z.object({ kind: z.literal('lateNotice'), noticeBy: isoDateSchema }),
	z.object({
		kind: z.literal('overBalance'),
		left: z.number().int(),
		over: z.number().int()
	}),
	z.object({ kind: z.literal('examCap'), used: z.number().int() }),
	z.object({ kind: z.literal('notMonday') })
])
export type AbsenceWarning = z.infer<typeof absenceWarningSchema>

/** POST /internal/employees/:id/absences (con `id` repetido no se duplica). */
export const createAbsenceRequestSchema = z.object({
	id: peopleIdSchema.optional(),
	absence: absenceInputSchema
})
/** PUT /internal/absences/:id */
export const updateAbsenceRequestSchema = z.object({
	absence: absenceInputSchema
})

export const absenceResponseSchema = z.object({
	absence: absenceSchema,
	warnings: z.array(absenceWarningSchema)
})
/** GET /internal/employees/:id/absences: las más nuevas primero. */
export const listAbsencesResponseSchema = z.object({
	absences: z.array(absenceSchema)
})

/** El saldo de vacaciones de una temporada (1/10 al 30/9). */
export const vacationBalanceSchema = z.object({
	/** La temporada: las que empiezan del 1/10 de ese año al 30/9 siguiente. */
	year: z.number().int(),
	days: z.number().int().min(0),
	taken: z.number().int().min(0),
	left: z.number().int()
})
export type VacationBalance = z.infer<typeof vacationBalanceSchema>

/** GET /internal/employees/:id/vacation-balance?day= (sin `day`, hoy). */
export const vacationBalanceQuerySchema = z.object({
	day: isoDateSchema.optional()
})
export const vacationBalanceResponseSchema = z.object({
	balance: vacationBalanceSchema
})
