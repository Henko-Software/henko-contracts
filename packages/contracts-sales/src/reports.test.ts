import { describe, expect, it } from 'vitest'

import { salesMatrixRequestSchema, salesReportRequestSchema } from './index.js'

describe('reportes de ventas', () => {
	it('el pedido del reporte completa filtros y datos auxiliares', () => {
		const parsed = salesReportRequestSchema.parse({
			current: { from: '2026-11-01', to: '2026-11-05' },
			previous: { from: '2026-10-01', to: '2026-10-05' },
			groupBy: 'zone'
		})
		expect(parsed).toMatchObject({ filters: {}, articles: [], customers: [] })
	})

	it('un período al revés no pasa', () => {
		expect(
			salesMatrixRequestSchema.safeParse({
				range: { from: '2026-11-05', to: '2026-11-01' },
				groupBy: 'customer'
			}).success
		).toBe(false)
	})
})
