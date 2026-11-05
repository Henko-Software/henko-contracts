import { describe, expect, it } from 'vitest'

import {
	invoiceEventSchema,
	listStatementLinesQuerySchema,
	sourceKeySchema,
	statementLineInputSchema
} from './index.js'

const LINE = '0192b0a1-7c00-7000-8000-0000000000a1'

describe('contrato de reporting', () => {
	it('sólo los subtotales llevan fórmula', () => {
		const base = {
			code: '30-00',
			name: 'Utilidad bruta',
			parentId: null,
			percentBase: false,
			notes: null
		}
		expect(
			statementLineInputSchema.safeParse({
				...base,
				kind: 'subtotal',
				formula: [{ lineId: LINE, sign: 'add' }]
			}).success
		).toBe(true)
		expect(
			statementLineInputSchema.safeParse({
				...base,
				kind: 'subtotal',
				formula: []
			}).success
		).toBe(false)
		expect(
			statementLineInputSchema.safeParse({
				...base,
				kind: 'common',
				formula: [{ lineId: LINE, sign: 'add' }]
			}).success
		).toBe(false)
	})

	it('los filtros del listado aceptan listas separadas por coma', () => {
		expect(
			listStatementLinesQuerySchema.parse({ kinds: 'title,subtotal' }).kinds
		).toEqual(['title', 'subtotal'])
	})

	it('las fuentes son de ventas o de compras', () => {
		expect(sourceKeySchema.safeParse('sales:pizzas').success).toBe(true)
		expect(sourceKeySchema.safeParse('purchases:_concept').success).toBe(true)
		expect(sourceKeySchema.safeParse('bank:fees').success).toBe(false)
	})

	it('una factura autorizada vieja (sin líneas) sigue entrando', () => {
		const parsed = invoiceEventSchema.parse({
			invoice: {
				id: LINE,
				kind: 'invoice',
				letter: 'A',
				number: '0002-00000001',
				customerId: LINE,
				localId: null,
				total: 12_100,
				authorization: 'authorized'
			}
		})
		expect(parsed.invoice.lines).toEqual([])
	})
})
