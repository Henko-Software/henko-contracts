import { z } from 'zod'

import { listParam } from '@henko-software/contracts-common'

import {
	airesCodeSchema,
	cuitSchema,
	employeeContactSchema,
	historyEntrySchema,
	isoDateSchema,
	lookupCodeSchema,
	peopleIdSchema,
	recordStatusSchema
} from './common.js'

/**
 * Empleados (Aires: Administración › Empleados). Copia
 * `henko-web/apps/web/src/data/employees/schema.ts` y suma lo que el front
 * todavía no tiene: el vínculo opcional con un usuario de identity
 * (`userId`) y los datos de la foto de cada papel (los bytes van por
 * `@henko-software/files`; el BFF arma el `photoUrl`).
 */

/** Dónde trabaja: planta, depósito, oficinas o un local (un cliente). */
export const WORKPLACES = ['plant', 'warehouse', 'office', 'store'] as const
export const workplaceKindSchema = z.enum(WORKPLACES)
export type WorkplaceKind = z.infer<typeof workplaceKindSchema>

export const EXIT_REASONS = [
	'resignation',
	'dismissal',
	'contract_end',
	'retirement',
	'other'
] as const
export const exitReasonSchema = z.enum(EXIT_REASONS)
export type ExitReason = z.infer<typeof exitReasonSchema>

export const EMPLOYEE_DOC_TYPES = ['CUIL', 'DNI'] as const
export const employeeDocTypeSchema = z.enum(EMPLOYEE_DOC_TYPES)

/** Calculado: trabajando, con egreso que todavía no llegó, egresado o dado de baja. */
export const EMPLOYMENT_STATES = [
	'working',
	'leaving',
	'left',
	'deleted'
] as const
export const employmentStateSchema = z.enum(EMPLOYMENT_STATES)
export type EmploymentState = z.infer<typeof employmentStateSchema>

/** Los papeles que se controlan. */
export const EMPLOYEE_PAPERS = [
	'foodHandler',
	'driverLicense',
	'preEmployment'
] as const
export const employeePaperSchema = z.enum(EMPLOYEE_PAPERS)
export type EmployeePaper = z.infer<typeof employeePaperSchema>

/** Tope de la foto de un papel (ya achicada por el front). */
export const PAPER_PHOTO_MAX_BYTES = 2 * 1024 * 1024
/** Tope del `data:` URL de una foto (base64 + cabecera). */
export const PAPER_PHOTO_MAX_DATA_URL =
	Math.ceil((PAPER_PHOTO_MAX_BYTES * 4) / 3) + 100

/** La foto guardada de un papel: tipo, tamaño y cuándo se subió. */
export const paperPhotoSchema = z.object({
	contentType: z.string().min(1).max(100),
	size: z.number().int().min(1).max(PAPER_PHOTO_MAX_BYTES),
	updatedAt: z.iso.datetime()
})
export type PaperPhoto = z.infer<typeof paperPhotoSchema>

/**
 * La foto que se manda al guardar: un `data:` URL (foto nueva), cualquier
 * otro texto (la que ya estaba, p. ej. el `photoUrl` que devolvió el BFF:
 * queda como está) o `null` (se saca).
 */
export const paperPhotoInputSchema = z
	.string()
	.max(PAPER_PHOTO_MAX_DATA_URL)
	.nullable()

const papersShape = <T extends z.ZodType>(photo: T) =>
	z.object({
		/** Carnet de manipulador: cuándo lo sacó (dura 3 años). */
		foodHandler: z.object({ issuedAt: isoDateSchema, photo }).nullable(),
		/** Licencia de conducir profesional: hasta cuándo vale. */
		driverLicense: z.object({ until: isoDateSchema, photo }).nullable(),
		/** Preocupacional: cuándo se hizo. No vence. */
		preEmployment: z.object({ doneAt: isoDateSchema, photo }).nullable()
	})

export const employeePapersSchema = papersShape(paperPhotoSchema.nullable())
export type EmployeePapers = z.infer<typeof employeePapersSchema>
export const employeePapersInputSchema = papersShape(paperPhotoInputSchema)

export const emergencyContactSchema = z.object({
	name: z.string().trim().min(1).max(80),
	/** «Pareja», «Madre». */
	relationship: z.string().trim().max(40).nullable(),
	phone: z.string().trim().min(1).max(40)
})

const employeeFields = {
	/** «Legajo Nro.» */
	fileNumber: z.string().trim().min(1).max(10),
	hiredAt: isoDateSchema,
	lastNames: z.string().trim().min(1).max(80),
	firstNames: z.string().trim().min(1).max(80),
	docType: employeeDocTypeSchema,
	docNumber: z.string().trim().max(20),
	category: lookupCodeSchema,
	department: lookupCodeSchema,
	birthDate: isoDateSchema.nullable(),
	schedule: lookupCodeSchema,
	contact: employeeContactSchema,
	/** «Observaciones» */
	notes: z.string().max(2000).nullable(),
	workplace: z.object({
		kind: workplaceKindSchema,
		/** El local, si trabaja en uno: el id del cliente (contacts). */
		storeId: z.string().trim().min(1).max(80).nullable()
	}),
	/** Egreso: si tiene fecha, deja de trabajar ese día. */
	exit: z
		.object({
			date: isoDateSchema,
			reason: exitReasonSchema,
			note: z.string().max(500).nullable()
		})
		.nullable(),
	emergencyContact: emergencyContactSchema.nullable(),
	/** Usuario de identity de esta persona, si tiene (uno por empleado). */
	userId: z.uuid().nullable()
}

/** Un empleado como lo devuelve people. */
export const employeeSchema = z.object({
	id: peopleIdSchema,
	/** 6 dígitos, lo pone el sistema. */
	code: airesCodeSchema,
	...employeeFields,
	papers: employeePapersSchema,
	status: recordStatusSchema,
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime()
})
export type Employee = z.infer<typeof employeeSchema>

/** El DNI que se compara: el número o los 8 del medio de un CUIL. */
export const dniDigits = (docNumber: string): string => {
	const digits = docNumber.replace(/\D/g, '')
	return digits.length === 11 ? digits.slice(2, 10) : digits
}

/**
 * Lo que se carga en el alta o la edición. Además de lo que valida el
 * front en el schema, repite lo que hoy hace sólo el formulario: DNI de 7 u
 * 8 dígitos y egreso no antes del ingreso (el nacimiento antes de hoy lo
 * mira people, que sabe qué día es).
 */
export const employeeInputSchema = z
	.object({
		...employeeFields,
		/** Sin mandar = no cambia el vínculo (el front todavía no lo tiene). */
		userId: z.uuid().nullable().optional(),
		papers: employeePapersInputSchema
	})
	.superRefine((employee, context) => {
		if (
			employee.docType === 'CUIL' &&
			!cuitSchema.safeParse(employee.docNumber).success
		)
			context.addIssue({
				code: 'custom',
				path: ['docNumber'],
				message: 'CUIL con guiones y dígito verificador válido: 20-12345678-6'
			})
		if (employee.docType === 'DNI' && !/^\d{7,8}$/.test(employee.docNumber))
			context.addIssue({
				code: 'custom',
				path: ['docNumber'],
				message: 'El DNI tiene 7 u 8 dígitos.'
			})
		if (employee.workplace.kind === 'store' && !employee.workplace.storeId)
			context.addIssue({
				code: 'custom',
				path: ['workplace', 'storeId'],
				message: 'Falta el local'
			})
		if (employee.exit && employee.exit.date < employee.hiredAt)
			context.addIssue({
				code: 'custom',
				path: ['exit', 'date'],
				message: 'El egreso no puede ser antes del ingreso.'
			})
	})
export type EmployeeInput = z.input<typeof employeeInputSchema>

/** Filtros de `GET /internal/employees` (Y entre filtros, O dentro de uno). */
export const PAPER_FILTERS = ['due', 'missing'] as const
export const listEmployeesQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	statuses: listParam(recordStatusSchema),
	states: listParam(employmentStateSchema),
	categories: listParam(lookupCodeSchema),
	departments: listParam(lookupCodeSchema),
	schedules: listParam(lookupCodeSchema),
	workplaces: listParam(workplaceKindSchema),
	papers: listParam(z.enum(PAPER_FILTERS)),
	/** Los de esos locales (`workplace.storeId`). */
	storeIds: listParam(z.string().trim().min(1).max(80))
})
export type ListEmployeesQuery = z.output<typeof listEmployeesQuerySchema>

/** GET /internal/employees: por «Apellido, Nombre». */
export const listEmployeesResponseSchema = z.object({
	employees: z.array(employeeSchema)
})
export const employeeResponseSchema = z.object({ employee: employeeSchema })
/** GET /internal/employees/:id (la lectura de la ficha queda auditada). */
export const employeeDetailResponseSchema = z.object({
	employee: employeeSchema,
	history: z.array(historyEntrySchema)
})

/**
 * GET /internal/employees/:id/reads: quién consultó la ficha o las fotos
 * (auditoría de lectura). Las lecturas de un superadmin sólo las ve un
 * superadmin.
 */
export const employeeReadsResponseSchema = z.object({
	reads: z.array(historyEntrySchema)
})

/** POST /internal/employees: con `id` repetido no se duplica. */
export const createEmployeeRequestSchema = z.object({
	id: peopleIdSchema.optional(),
	employee: employeeInputSchema
})
export type CreateEmployeeRequest = z.input<typeof createEmployeeRequestSchema>
/** PUT /internal/employees/:id: el objeto entero. */
export const updateEmployeeRequestSchema = z.object({
	employee: employeeInputSchema
})

/** POST /internal/employees/status: baja o recuperación masiva, todo o nada. */
export const setEmployeesStatusRequestSchema = z.object({
	ids: z.array(peopleIdSchema).min(1).max(500),
	status: recordStatusSchema
})

/** GET /internal/employees/by-doc/:digits */
export const findByDocResponseSchema = z.object({
	employee: employeeSchema.nullable()
})

/** GET /internal/employees/next-file-number */
export const nextFileNumberResponseSchema = z.object({
	fileNumber: z.string()
})

/** GET /internal/employees/:id/papers/:paper/photo: los bytes en base64. */
export const paperPhotoResponseSchema = z.object({
	contentType: z.string(),
	data: z.string()
})
