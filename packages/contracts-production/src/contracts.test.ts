import { describe, expect, it } from 'vitest'

import {
	closeOrderRequestSchema,
	orderClosedEventSchema,
	recallInputSchema,
	traceSourceSchema
} from './index.js'

const ARTICLE = '0192b0a1-7c00-7000-8000-0000000000a1'
const ORDER = '0192b0a1-7c00-7000-8000-0000000000b1'

describe('contrato de production', () => {
	it('un retiro pide el motivo; un simulacro no', () => {
		const base = { articleId: ARTICLE, lot: '05-11-26', reason: null }
		expect(
			recallInputSchema.safeParse({ ...base, kind: 'drill' }).success
		).toBe(true)
		expect(
			recallInputSchema.safeParse({ ...base, kind: 'recall' }).success
		).toBe(false)
	})

	it('cerrar una orden pide lo producido en positivo', () => {
		const result = closeOrderRequestSchema.safeParse({
			produced: 0,
			inputs: [],
			article: {},
			locations: [],
			lots: []
		})
		expect(result.success).toBe(false)
	})

	it('el evento de cierre trae al menos un movimiento', () => {
		const order = {
			id: ORDER,
			number: '009301',
			articleId: ARTICLE,
			deliveryDate: '2026-11-06',
			produced: 10,
			lot: '05-11-26',
			expiry: '2026-12-05'
		}
		expect(
			orderClosedEventSchema.safeParse({ order, date: '2026-11-05', moves: [] })
				.success
		).toBe(false)
		expect(
			orderClosedEventSchema.safeParse({
				order,
				date: '2026-11-05',
				moves: [
					{
						kind: 'production',
						articleId: ARTICLE,
						locationId: 'ub-n-cong',
						lot: '05-11-26',
						expiry: '2026-12-05',
						quantity: 10
					}
				]
			}).success
		).toBe(true)
	})

	it('la fuente de trazabilidad acepta listas vacías', () => {
		expect(
			traceSourceSchema.safeParse({
				movements: [],
				customers: [],
				articles: [],
				receptions: []
			}).success
		).toBe(true)
	})
})
