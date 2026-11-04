import { z } from 'zod'

import { flagValuesSchema } from '@henko-software/contracts-flags'

import { roleSchema } from './roles.js'

/**
 * Contrato interno de `identity`. Lo llama el BFF (y después el orquestador)
 * con un token interno firmado (`@henko-software/service-auth`). Las rutas
 * van bajo `/internal`.
 *
 * Los ids son UUIDv7 y las fechas, ISO en UTC.
 */

export const userStatusSchema = z.enum(['active', 'disabled'])

export const userSchema = z.object({
	id: z.uuid(),
	email: z.email(),
	name: z.string().min(1).max(120),
	role: roleSchema,
	/** Locales que puede ver. Vacío = todos (superadmin y casa central). */
	localIds: z.array(z.string().min(1)),
	status: userStatusSchema,
	createdAt: z.iso.datetime()
})
export type User = z.infer<typeof userSchema>

/** Mínimo 10 caracteres: frase larga mejor que símbolos raros. */
export const passwordSchema = z.string().min(10).max(200)

// ---------- Organización de la instancia

/**
 * Lo que cada central prende o apaga de Henko (no son flags de sección: son
 * reglas de negocio de esa central).
 */
export const organizationSettingsSchema = z.object({
	/** Calcular los sellos de etiquetado frontal (Ley 27.642). */
	frontLabeling: z.boolean(),
	/** Si paga comisiones a sus vendedores. */
	commissions: z.boolean()
})
export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>

/**
 * La central de esta instancia (Henko va una instancia por cliente), vista
 * por una persona: `unit` es dónde está parada según sus locales
 * («Casa central» o el nombre de su local).
 */
export const organizationSchema = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(1).max(60),
	unit: z.string().trim().max(60),
	/** Logo cuadrado (PNG o SVG de 256 px o más); `null` = las iniciales. */
	logoUrl: z.string().max(500).nullable(),
	settings: organizationSettingsSchema
})
export type Organization = z.infer<typeof organizationSchema>

// ---------- «Ver como» (sólo un superadmin real)

/** Se puede ver como cualquier rol menos otro superadmin. */
export const viewAsRoleSchema = roleSchema.exclude(['superadmin'])

/**
 * Qué simular: un rol (opcionalmente en un local) o una persona concreta
 * (`userId`, sólo lectura). Con `userId`, el rol tiene que ser el de esa
 * persona y el local, uno de los suyos.
 */
export const viewAsRequestSchema = z.object({
	role: viewAsRoleSchema,
	userId: z.uuid().optional(),
	localId: z.string().min(1).optional()
})
export type ViewAsRequest = z.infer<typeof viewAsRequestSchema>

/** El «ver como» en curso, como lo guarda la sesión. Dura 8 horas. */
export const viewAsStateSchema = z.object({
	role: viewAsRoleSchema,
	/** La persona concreta, si se eligió una. */
	user: z
		.object({ id: z.uuid(), name: z.string(), email: z.email() })
		.nullable(),
	localId: z.string().nullable(),
	/** Viendo como una persona concreta, nada se puede cambiar. */
	readOnly: z.boolean(),
	startedAt: z.iso.datetime(),
	expiresAt: z.iso.datetime()
})
export type ViewAsState = z.infer<typeof viewAsStateSchema>

/**
 * Con qué se trata a la persona: su rol y sus locales, o los simulados si
 * hay «ver como». Permisos, scope y flags usan esto; auditoría, el real.
 */
export const effectiveAccessSchema = z.object({
	userId: z.uuid(),
	role: roleSchema,
	localIds: z.array(z.string().min(1))
})
export type EffectiveAccess = z.infer<typeof effectiveAccessSchema>

/**
 * Lo que acompaña a una sesión resuelta: el acceso efectivo, el «ver como»,
 * la organización vista por esa persona y los flags guardados en la base
 * (la capa `base`; el BFF los resuelve con el resto).
 */
const sessionContextShape = {
	effective: effectiveAccessSchema,
	viewAs: viewAsStateSchema.nullable(),
	organization: organizationSchema,
	flags: flagValuesSchema
}

// ---------- Sesiones

/** POST /internal/sessions — login. */
export const createSessionRequestSchema = z.object({
	email: z.email(),
	password: z.string().min(1).max(200),
	userAgent: z.string().max(400).optional(),
	ip: z.string().max(64).optional()
})
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>

export const sessionSchema = z.object({
	id: z.uuid(),
	expiresAt: z.iso.datetime()
})

export const createSessionResponseSchema = z.object({
	session: sessionSchema,
	/** Token opaco para la cookie. Se devuelve una sola vez; identity guarda su hash. */
	token: z.string().min(32),
	/** La persona real. */
	user: userSchema,
	...sessionContextShape
})
export type CreateSessionResponse = z.infer<typeof createSessionResponseSchema>

/** POST /internal/sessions/resolve — ¿de quién es esta cookie? */
export const resolveSessionRequestSchema = z.object({
	token: z.string().min(32)
})
export const resolveSessionResponseSchema = z.object({
	session: sessionSchema,
	/** La persona real (la del «ver como» va en `viewAs.user`). */
	user: userSchema,
	...sessionContextShape
})
export type ResolveSessionResponse = z.infer<
	typeof resolveSessionResponseSchema
>

/** POST /internal/sessions/revoke — logout. Responde 204. */
export const revokeSessionRequestSchema = resolveSessionRequestSchema

/**
 * POST /internal/sessions/view-as — un superadmin real empieza (o cambia) a
 * «ver como». Responde la sesión resuelta (`resolveSessionResponseSchema`).
 */
export const startViewAsRequestSchema = z.object({
	token: z.string().min(32),
	viewAs: viewAsRequestSchema
})

/**
 * POST /internal/sessions/view-as/stop — vuelve a superadmin. Idempotente.
 * Responde la sesión resuelta.
 */
export const stopViewAsRequestSchema = resolveSessionRequestSchema

// ---------- Usuarios (sólo superadmin y casa central)

/** GET /internal/users */
export const listUsersResponseSchema = z.object({ users: z.array(userSchema) })

/** POST /internal/users */
export const createUserRequestSchema = z.object({
	email: z.email(),
	name: z.string().trim().min(1).max(120),
	role: roleSchema,
	localIds: z.array(z.string().min(1)).default([]),
	password: passwordSchema
})
export type CreateUserRequest = z.input<typeof createUserRequestSchema>
export const createUserResponseSchema = z.object({ user: userSchema })

// ---------- Dispositivos (cajas)

export const deviceSchema = z.object({
	id: z.uuid(),
	name: z.string().min(1).max(80),
	localId: z.string().min(1),
	status: z.enum(['active', 'revoked']),
	createdAt: z.iso.datetime(),
	revokedAt: z.iso.datetime().nullable()
})
export type Device = z.infer<typeof deviceSchema>

/** GET /internal/devices */
export const listDevicesResponseSchema = z.object({
	devices: z.array(deviceSchema)
})

/** POST /internal/devices — alta de una caja. */
export const registerDeviceRequestSchema = z.object({
	name: z.string().trim().min(1).max(80),
	localId: z.string().min(1)
})
export const registerDeviceResponseSchema = z.object({
	device: deviceSchema,
	/** Secreto de la caja. Se muestra una sola vez; identity guarda su hash. */
	secret: z.string().min(32)
})

/** POST /internal/devices/:id/revoke — responde el dispositivo revocado. */
export const revokeDeviceResponseSchema = z.object({ device: deviceSchema })

// ---------- Flags guardados (la capa `base`; sólo superadmin)

/** GET /internal/flags · PUT /internal/flags/:key (`setFlagRequestSchema`) */
export const flagValuesResponseSchema = z.object({ values: flagValuesSchema })

// ---------- Errores que puede devolver

/** Claves de error propias de identity (además de las `common.*`). */
export const IDENTITY_ERRORS = [
	'identity.invalid_credentials',
	'identity.user_disabled',
	'identity.email_taken',
	'identity.session_expired',
	'identity.device_not_found',
	'identity.view_as_forbidden',
	'identity.view_as_invalid',
	'identity.organization_not_configured'
] as const
export type IdentityErrorKey = (typeof IDENTITY_ERRORS)[number]

// ---------- Eventos

/** `identity.user.created.v1` */
export const userCreatedEventSchema = z.object({
	user: userSchema.omit({ email: true }).extend({ id: z.uuid() })
})
/** `identity.device.revoked.v1` — las cajas lo escuchan para borrar sus datos. */
export const deviceRevokedEventSchema = z.object({
	deviceId: z.uuid(),
	localId: z.string()
})
