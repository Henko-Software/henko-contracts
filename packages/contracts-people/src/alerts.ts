import { z } from 'zod'

import { isoDateSchema, peopleIdSchema } from './common.js'
import { employeePaperSchema } from './employees.js'

/**
 * Lo que viene y lo que no está al día (Resumen de administración):
 * papeles vencidos, por vencer (30 días) o que faltan, fin del período de
 * prueba (15 días antes), egresos dentro del horizonte y cumpleaños de esta
 * semana. Cada aviso trae el empleado para armar el link a su ficha.
 */
export const ALERT_KINDS = ['paper', 'probation', 'exit', 'birthday'] as const
export const alertKindSchema = z.enum(ALERT_KINDS)

export const PAPER_STATES = ['missing', 'expired', 'soon'] as const
export const paperStateSchema = z.enum(PAPER_STATES)

export const employeeAlertSchema = z.object({
	/** `paper-<id>-foodHandler`, `probation-<id>`, `exit-<id>`, `birthday-<id>`. */
	key: z.string(),
	kind: alertKindSchema,
	employeeId: peopleIdSchema,
	/** «Nombre Apellido». */
	name: z.string(),
	/** Vencimiento, fin de la prueba, egreso o cumpleaños; `null` si falta el papel. */
	date: isoDateSchema.nullable(),
	paper: employeePaperSchema.nullable(),
	paperState: paperStateSchema.nullable()
})
export type EmployeeAlert = z.infer<typeof employeeAlertSchema>

/** GET /internal/employees/alerts?horizonDays=30&soonDays=7 */
export const employeeAlertsQuerySchema = z.object({
	horizonDays: z.coerce.number().int().min(1).max(365).default(30),
	soonDays: z.coerce.number().int().min(1).max(60).default(7)
})
export const employeeAlertsResponseSchema = z.object({
	/** El día de Argentina con que se calculó. */
	today: isoDateSchema,
	/** Los que están en nómina (trabajando o con egreso por venir). */
	onPayroll: z.number().int().min(0),
	alerts: z.array(employeeAlertSchema)
})
