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
