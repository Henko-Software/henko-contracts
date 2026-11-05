import { describe, expect, it } from 'vitest'

import {
	adminSummarySchema,
	bffIncomeLineInputSchema,
	listBffIncomeLinesQuerySchema
} from './index.js'

describe('reportes del BFF', () => {
	it('un rubro común no lleva fórmula; un subtotal sí', () => {
		const base = {
			code: '30-00',
			name: 'Utilidad bruta',
			parentId: null,
			percentBase: false,
			notes: null
		}
		expect(
			bffIncomeLineInputSchema.safeParse({
				...base,
				kind: 'subtotal',
				formula: [{ lineId: 'x', sign: 'add' }]
			}).success
		).toBe(true)
		expect(
			bffIncomeLineInputSchema.safeParse({
				...base,
				kind: 'common',
				formula: []
			}).success
		).toBe(true)
		expect(
			bffIncomeLineInputSchema.safeParse({
				...base,
				kind: 'subtotal',
				formula: []
			}).success
		).toBe(false)
	})

	it('los filtros de rubros van separados por coma', () => {
		expect(
			listBffIncomeLinesQuerySchema.parse({ statuses: 'active' }).statuses
		).toEqual(['active'])
	})

	it('el resumen dice qué no se pudo cargar', () => {
		const parsed = adminSummarySchema.safeParse({
			today: '2026-11-05',
			money: {
				receivable: 0,
				receivableOverdue: 0,
				overdueCustomers: 0,
				payable: 0,
				payableOverdue: 0,
				overdueSuppliers: 0,
				dueThisWeek: 0,
				activeCustomers: 0,
				stoppedBuying: 0
			},
			attention: [],
			cleanup: [],
			upcoming: [],
			receivables: { buckets: {}, overdue: 0, top: [] },
			business: [],
			unavailable: ['employees']
		})
		expect(parsed.success).toBe(true)
	})
})
