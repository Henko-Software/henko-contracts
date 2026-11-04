import { z } from 'zod'

import {
	ingestFeedbackResponseSchema,
	submitFeedbackSchema
} from '@henko-software/contracts-console'
import {
	effectiveFlagsSchema,
	flagNodeSchema,
	setFlagRequestSchema
} from '@henko-software/contracts-flags'
import {
	createUserRequestSchema,
	deviceSchema,
	organizationSchema,
	registerDeviceRequestSchema,
	userSchema,
	viewAsRequestSchema,
	viewAsStateSchema
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

/**
 * GET /api/me — la sesión como la usa el front.
 *
 * - `user`: como quién se pinta la app. Sin «ver como», la persona real. Con
 *   «ver como» un rol, la persona real con el rol y los locales simulados;
 *   con «ver como» una persona concreta, esa persona. El menú, el Inicio y lo
 *   que se muestra salen de acá.
 * - `realUser`: quién está adentro de verdad (para la barra «Estás viendo
 *   como… · Volver a superadmin» y el menú de la cuenta).
 * - `organization`: la central de la instancia; `unit` es dónde está parado
 *   `user` («Casa central» o su local).
 * - `flags`: los flags efectivos de `user`, todas las claves, ya resueltos
 *   (el superadmin sin «ver como» los tiene todos en `true`). El front no
 *   recalcula: si `flags[clave]` es `false`, la sección no se muestra.
 * - `viewAs`: el «ver como» en curso, o `null`. Con `readOnly`, toda
 *   mutación responde 403 `bff.view_as_read_only`.
 */
export const meResponseSchema = z.object({
	user: meSchema,
	realUser: meSchema,
	organization: organizationSchema,
	flags: effectiveFlagsSchema,
	viewAs: viewAsStateSchema.nullable()
})
export type MeResponse = z.infer<typeof meResponseSchema>

/** El login responde lo mismo que `/api/me`. */
export const loginResponseSchema = meResponseSchema

/**
 * POST /api/me/view-as — un superadmin empieza (o cambia) a «ver como» un
 * rol, o un rol y una persona concreta (sólo lectura). Responde el `/me`
 * nuevo: el front invalida su sesión y pinta de nuevo donde estaba.
 * Otro rol: 403 `identity.view_as_forbidden`.
 *
 * DELETE /api/me/view-as — vuelve a superadmin (idempotente). Responde el
 * `/me` nuevo.
 */
export const viewAsBodySchema = viewAsRequestSchema
export const viewAsResultSchema = meResponseSchema

/**
 * GET /api/flags — el panel de flags en árbol (sólo superadmin real; si
 * no, 403). Cada nodo dice su valor propio o heredado, de qué capa sale, lo
 * que ven los usuarios y lo guardado en la base.
 *
 * PUT /api/flags/:key — `{ enabled: true | false | null }` (`null` = vuelve a
 * heredar). Queda auditado. Responde el árbol nuevo. Los demás usuarios lo
 * ven en hasta 30 s (la caché de sesiones del BFF).
 */
export const flagTreeResponseSchema = z.object({
	flags: z.array(flagNodeSchema)
})
export type FlagTreeResponse = z.infer<typeof flagTreeResponseSchema>
export const setFlagBodySchema = setFlagRequestSchema

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

/**
 * POST /api/feedback (con sesión) — el botón de feedback. El BFF suma quién
 * reporta y lo reenvía a la Henko Console. 202 si llegó; si la Console no
 * responde, 503 y el front lo guarda para reintentar con el mismo `id`.
 */
export const submitFeedbackBodySchema = submitFeedbackSchema
export const submitFeedbackResultSchema = ingestFeedbackResponseSchema

/** Errores propios del BFF que el front puede mirar por `code`. */
export const BFF_ERRORS = [
	'bff.too_many_attempts',
	'bff.login_unavailable',
	'bff.feedback_unavailable',
	'bff.unsupported_media_type',
	'bff.payload_too_large',
	'bff.invalid_json',
	'bff.view_as_read_only'
] as const
export type BffErrorKey = (typeof BFF_ERRORS)[number]

/**
 * Forma de todo error. En los de validación (`common.validation`),
 * `details.fields` trae el problema de cada campo, en castellano, por su
 * ruta (`email`, `items.0.price`; `_` = el pedido entero).
 */
export const errorBodySchema = z.object({
	error: z.object({
		code: z.string(),
		message: z.string(),
		ref: z.string(),
		details: z.record(z.string(), z.unknown()).optional()
	})
})
export type ErrorBody = z.infer<typeof errorBodySchema>
