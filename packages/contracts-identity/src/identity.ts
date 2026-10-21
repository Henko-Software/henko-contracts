import { z } from 'zod'

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
	user: userSchema
})
export type CreateSessionResponse = z.infer<typeof createSessionResponseSchema>

/** POST /internal/sessions/resolve — ¿de quién es esta cookie? */
export const resolveSessionRequestSchema = z.object({
	token: z.string().min(32)
})
export const resolveSessionResponseSchema = z.object({
	session: sessionSchema,
	user: userSchema
})
export type ResolveSessionResponse = z.infer<
	typeof resolveSessionResponseSchema
>

/** POST /internal/sessions/revoke — logout. Responde 204. */
export const revokeSessionRequestSchema = resolveSessionRequestSchema

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

// ---------- Errores que puede devolver

/** Claves de error propias de identity (además de las `common.*`). */
export const IDENTITY_ERRORS = [
	'identity.invalid_credentials',
	'identity.user_disabled',
	'identity.email_taken',
	'identity.session_expired',
	'identity.device_not_found'
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
