import { describe, expect, it } from 'vitest'

import { salesReportQuerySchema } from './index.js'

describe('reportes de ventas en el BFF', () => {
	it('los filtros vienen como lista en la URL', () => {
		expect(
			salesReportQuerySchema.parse({
				from: '2026-11-01',
				to: '2026-11-05',
				compareFrom: '2026-10-01',
				compareTo: '2026-10-05',
				groupBy: 'article',
				zone: 'CABA Norte,GBA Sur'
			})
		).toMatchObject({ zone: ['CABA Norte', 'GBA Sur'] })
	})
})
