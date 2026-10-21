import { z } from 'zod'

import {
	createUserRequestSchema,
	deviceSchema,
	registerDeviceRequestSchema,
	userSchema
} from '@henko-software/contracts-identity'

/**
 * Contrato de la API pública de `henko-bff` (la que usa `henko-web`). La
 * sesión va en una cookie `httpOnly` (`henko_session`); el front nunca ve el
 * token. Todas las rutas van bajo `/api`.
 *
 * Errores: siempre `{ error: { code, message, ref, details? } }`.
 */

export const SESSION_COOKIE = 'henko_session'

/** POST /api/auth/login */
export const loginRequestSchema = z.object({
	email: z.email(),
	password: z.string().min(1).max(200)
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

/** El usuario como lo ve el front (sin nada interno). */
export const meSchema = userSchema.pick({
	id: true,
	email: true,
	name: true,
	role: true,
	localIds: true
})
export type Me = z.infer<typeof meSchema>

export const loginResponseSchema = z.object({ user: meSchema })

/** GET /api/me */
export const meResponseSchema = z.object({ user: meSchema })

/** POST /api/auth/logout — responde 204 y borra la cookie. */

/** GET /api/users · POST /api/users (casa central) */
export const usersResponseSchema = z.object({ users: z.array(userSchema) })
export const createUserBodySchema = createUserRequestSchema
export const createUserResultSchema = z.object({ user: userSchema })

/** GET /api/devices · POST /api/devices · POST /api/devices/:id/revoke */
export const devicesResponseSchema = z.object({
	devices: z.array(deviceSchema)
})
export const registerDeviceBodySchema = registerDeviceRequestSchema
export const registerDeviceResultSchema = z.object({
	device: deviceSchema,
	secret: z.string()
})

/** Forma de todo error. */
export const errorBodySchema = z.object({
	error: z.object({
		code: z.string(),
		message: z.string(),
		ref: z.string(),
		details: z.record(z.string(), z.unknown()).optional()
	})
})
export type ErrorBody = z.infer<typeof errorBodySchema>
