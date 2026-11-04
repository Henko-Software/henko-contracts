import { describe, expect, it } from 'vitest'

import { createUserRequestSchema, userSchema } from './index.js'

describe('contrato de identity', () => {
	it('un usuario válido pasa y uno sin rol conocido no', () => {
		const user = {
			id: '0192b0a1-7c00-7000-8000-000000000001',
			email: 'ana@example.com',
			name: 'Ana',
			role: 'cashier',
			localIds: ['loc-1'],
			status: 'active',
			createdAt: '2026-10-21T12:00:00.000Z'
		}
		expect(userSchema.parse(user)).toEqual(user)
		expect(userSchema.safeParse({ ...user, role: 'jefe' }).success).toBe(false)
	})

	it('pide contraseñas de 10 caracteres o más', () => {
		const base = {
			email: 'a@b.com',
			name: 'A',
			role: 'admin' as const
		}
		expect(
			createUserRequestSchema.safeParse({ ...base, password: 'corta' }).success
		).toBe(false)
		expect(
			createUserRequestSchema.parse({ ...base, password: 'una frase larga' })
				.localIds
		).toEqual([])
	})
})

describe('«ver como» y organización', () => {
	it('no se puede ver como otro superadmin', async () => {
		const { viewAsRequestSchema } = await import('./index.js')
		expect(viewAsRequestSchema.safeParse({ role: 'cashier' }).success).toBe(
			true
		)
		expect(viewAsRequestSchema.safeParse({ role: 'superadmin' }).success).toBe(
			false
		)
	})

	it('una organización sin logo usa las iniciales (null)', async () => {
		const { organizationSchema } = await import('./index.js')
		expect(
			organizationSchema.parse({
				id: 'org-1',
				name: 'Pizzería de Ejemplo',
				unit: 'Casa central',
				logoUrl: null,
				settings: { frontLabeling: true, commissions: false }
			}).logoUrl
		).toBeNull()
	})

	it('nombres por id: de 1 a 200 uuids', async () => {
		const { userNamesRequestSchema, USER_NAMES_MAX_IDS } =
			await import('./index.js')
		const id = '0190a5b1-0000-7000-8000-000000000001'
		expect(userNamesRequestSchema.safeParse({ ids: [id] }).success).toBe(true)
		expect(userNamesRequestSchema.safeParse({ ids: [] }).success).toBe(false)
		expect(userNamesRequestSchema.safeParse({ ids: ['u1'] }).success).toBe(
			false
		)
		expect(
			userNamesRequestSchema.safeParse({
				ids: Array.from({ length: USER_NAMES_MAX_IDS + 1 }, () => id)
			}).success
		).toBe(false)
	})
})
