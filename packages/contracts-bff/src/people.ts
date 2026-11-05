import { z } from 'zod'

import {
	absenceInputSchema,
	absenceSchema,
	absenceWarningSchema,
	airesCodeSchema,
	emergencyContactSchema,
	employeeAlertSchema,
	employeeContactSchema,
	employeeDocTypeSchema,
	exitReasonSchema,
	isoDateSchema,
	listEmployeesQuerySchema,
	lookupCodeSchema,
	PAPER_PHOTO_MAX_DATA_URL,
	PEOPLE_LOOKUP_TABLES,
	recordStatusSchema,
	rosterSchema,
	setEmployeesStatusRequestSchema,
	vacationBalanceSchema,
	workplaceKindSchema
} from '@henko-software/contracts-people'

import { historyEventSchema } from './admin/common.js'

/**
 * Empleados (`/admin/employees`), armado con `people`. Las formas copian
 * `henko-web/apps/web/src/data/employees/schema.ts`: la foto de cada papel
 * viaja como `photoUrl` (al guardar, un `data:` URL nuevo, la misma
 * dirección que vino = sin cambios, o `null`); el historial lleva el nombre
 * de quien hizo cada cosa (vacío si fue un superadmin y quien mira no lo
 * es). Todo con el flag `team.employees`; los datos son sensibles: sólo
 * Recursos Humanos (hoy, la casa central).
 */

const papersShape = <T extends z.ZodType>(photoUrl: T) =>
	z.object({
		foodHandler: z.object({ issuedAt: isoDateSchema, photoUrl }).nullable(),
		driverLicense: z.object({ until: isoDateSchema, photoUrl }).nullable(),
		preEmployment: z.object({ doneAt: isoDateSchema, photoUrl }).nullable()
	})

const employeeFields = {
	fileNumber: z.string().trim().min(1).max(10),
	hiredAt: isoDateSchema,
	lastNames: z.string().trim().min(1).max(80),
	firstNames: z.string().trim().min(1).max(80),
	docType: employeeDocTypeSchema,
	docNumber: z.string().max(20),
	category: lookupCodeSchema,
	department: lookupCodeSchema,
	birthDate: isoDateSchema.nullable(),
	schedule: lookupCodeSchema,
	contact: employeeContactSchema,
	notes: z.string().max(2000).nullable(),
	workplace: z.object({
		kind: workplaceKindSchema,
		storeId: z.string().nullable()
	}),
	exit: z
		.object({
			date: isoDateSchema,
			reason: exitReasonSchema,
			note: z.string().max(500).nullable()
		})
		.nullable(),
	emergencyContact: emergencyContactSchema.nullable()
}

/** Un empleado como lo usa el front (`Employee`), más el usuario vinculado. */
export const bffEmployeeSchema = z.object({
	id: z.string(),
	code: airesCodeSchema,
	...employeeFields,
	papers: papersShape(z.string().nullable()),
	/** Usuario de identity de esta persona, si tiene. */
	userId: z.string().nullable(),
	status: recordStatusSchema
})
export type BffEmployee = z.infer<typeof bffEmployeeSchema>

/**
 * POST /api/employees · PUT /api/employees/:id (`EmployeeInput`). `userId`
 * sin mandar = no cambia el vínculo. Las validaciones entre campos las
 * repite people.
 */
export const bffEmployeeInputSchema = z.object({
	...employeeFields,
	papers: papersShape(z.string().max(PAPER_PHOTO_MAX_DATA_URL).nullable()),
	userId: z.uuid().nullable().optional()
})
export type BffEmployeeInput = z.infer<typeof bffEmployeeInputSchema>

/** GET /api/employees?… (los filtros del front; Y entre filtros, O dentro de uno). */
export const listBffEmployeesQuerySchema = listEmployeesQuerySchema.omit({
	storeIds: true
})
export const listBffEmployeesResponseSchema = z.object({
	employees: z.array(bffEmployeeSchema)
})
export const bffEmployeeResponseSchema = z.object({
	employee: bffEmployeeSchema
})
/** GET /api/employees/:id (`EmployeeDetail`): la lectura queda auditada. */
export const bffEmployeeDetailResponseSchema = z.object({
	employee: bffEmployeeSchema,
	history: z.array(historyEventSchema)
})
/** GET /api/employees/:id/reads: quién consultó la ficha o sus fotos. */
export const bffEmployeeReadsResponseSchema = z.object({
	reads: z.array(historyEventSchema)
})

/** POST /api/employees/status: baja o recuperación masiva (204). */
export const bffSetEmployeesStatusBodySchema = setEmployeesStatusRequestSchema

/** GET /api/employees/by-doc/:digits */
export const bffFindEmployeeByDocResponseSchema = z.object({
	employee: bffEmployeeSchema.nullable()
})
/** GET /api/employees/next-file-number */
export const bffNextFileNumberResponseSchema = z.object({
	fileNumber: z.string()
})

/** GET /api/employees/roster?week=&… (mismos filtros que la lista). */
export const bffRosterQuerySchema = listBffEmployeesQuerySchema.extend({
	week: isoDateSchema
})
export const bffRosterResponseSchema = z.object({ roster: rosterSchema })

/** GET /api/employees/:id/absences: las más nuevas primero. */
export const bffAbsencesResponseSchema = z.object({
	absences: z.array(absenceSchema)
})
/** POST /api/employees/:id/absences · PUT /api/absences/:id (`AbsenceInput`). */
export const bffAbsenceInputSchema = absenceInputSchema
/** La ausencia guardada y lo que avisa (deja guardar). `H-EM002` si se pisa. */
export const bffAbsenceResponseSchema = z.object({
	absence: absenceSchema,
	warnings: z.array(absenceWarningSchema)
})

/** GET /api/employees/:id/vacation-balance?day= */
export const bffVacationBalanceQuerySchema = z.object({
	day: isoDateSchema.optional()
})
export const bffVacationBalanceResponseSchema = z.object({
	balance: vacationBalanceSchema
})

/**
 * GET /api/employees/alerts?horizonDays=30&soonDays=7 — lo que viene y lo
 * que no está al día (Resumen): papeles, fin de la prueba, egresos y
 * cumpleaños, con el total en nómina.
 */
export const bffEmployeeAlertsQuerySchema = z.object({
	horizonDays: z.coerce.number().int().min(1).max(365).default(30),
	soonDays: z.coerce.number().int().min(1).max(60).default(7)
})
export const bffEmployeeAlertsResponseSchema = z.object({
	today: isoDateSchema,
	onPayroll: z.number().int().min(0),
	alerts: z.array(employeeAlertSchema)
})

/** GET /api/employees/lookups/:table — `LookupEntry[]` del front. */
export const bffEmployeeLookupTableSchema = z.enum(PEOPLE_LOOKUP_TABLES)
export const bffEmployeeLookupResponseSchema = z.object({
	entries: z.array(z.object({ code: lookupCodeSchema, label: z.string() }))
})
