import { describe, expect, it } from 'vitest'

import {
	evaluateRequestSchema,
	listSitesQuerySchema,
	moveSiteRequestSchema
} from './index.js'

describe('contrato de network', () => {
	it('«No sirve» pide el motivo; los demás pasos no', () => {
		expect(
			moveSiteRequestSchema.safeParse({ status: 'discarded' }).success
		).toBe(false)
		expect(
			moveSiteRequestSchema.safeParse({ status: 'discarded', note: 'Chico' })
				.success
		).toBe(true)
		expect(moveSiteRequestSchema.safeParse({ status: 'visited' }).success).toBe(
			true
		)
	})

	it('los estados del listado viajan separados por coma', () => {
		expect(
			listSitesQuerySchema.parse({ status: 'watching,visited' }).status
		).toEqual(['watching', 'visited'])
	})

	it('la venta de los locales es opcional y en centavos enteros', () => {
		expect(
			evaluateRequestSchema.safeParse({ addressId: 'fake:1' }).success
		).toBe(true)
		expect(
			evaluateRequestSchema.safeParse({
				addressId: 'fake:1',
				sales: [{ customerId: 'c', monthly: 10.5, months: 3 }]
			}).success
		).toBe(false)
	})
})
