import { z } from 'zod'

/**
 * Roles de Henko (v0, a confirmar con el relevamiento de Aires). El permiso
 * fino llega después; por ahora el rol define qué puede hacer cada uno.
 *
 * - superadmin: equipo de Henko. Ve todo, incluso lo apagado por flags.
 * - admin: casa central. Administra usuarios, locales y dispositivos.
 * - franchisee: dueño de una franquicia. Ve y opera sus locales.
 * - manager: encargado de un local.
 * - cashier: cajero de un local.
 */
export const ROLES = [
	'superadmin',
	'admin',
	'franchisee',
	'manager',
	'cashier'
] as const

export const roleSchema = z.enum(ROLES)
export type Role = z.infer<typeof roleSchema>

/** Nombre para mostrar. El front puede usar sus propios textos. */
export const ROLE_LABELS: Record<Role, string> = {
	superadmin: 'Superadmin',
	admin: 'Casa central',
	franchisee: 'Franquiciado',
	manager: 'Encargado de local',
	cashier: 'Cajero'
}

/** Roles que administran usuarios y dispositivos. */
export const ADMIN_ROLES: readonly Role[] = ['superadmin', 'admin']
