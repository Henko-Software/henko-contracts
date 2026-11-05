import { describe, expect, it } from 'vitest'

import {
	createPurchaseInvoiceRequestSchema,
	createReceptionRequestSchema,
	listPurchaseOrdersQuerySchema
} from './index.js'

const ID = '0192b0a1-7c00-7000-8000-0000000000a1'

describe('contrato de purchasing', () => {
	it('los filtros vienen como lista', () => {
		expect(
			listPurchaseOrdersQuerySchema.parse({ statuses: 'late,partial' })
		).toMatchObject({ statuses: ['late', 'partial'], limit: 500 })
	})

	it('una recepción pide cuánto llegó y por qué se devuelve', () => {
		const reception = {
			purchaseOrderId: ID,
			date: '2026-11-05',
			time: '09:40',
			deliveryNote: null,
			photo: null,
			truck: { plate: null, clean: true, permitSeen: true },
			lines: [
				{
					articleId: 'a1',
					accepted: 0,
					rejected: 2,
					rejectReason: null,
					lot: null,
					expiry: null,
					temperature: null
				}
			],
			notes: null
		}
		expect(createReceptionRequestSchema.safeParse({ reception }).success).toBe(
			false
		)
		expect(
			createReceptionRequestSchema.parse({
				reception: {
					...reception,
					lines: [{ ...reception.lines[0], rejectReason: 'damaged' }]
				}
			}).reception.closesOrder
		).toBe(false)
	})

	it('el total de la factura tiene que coincidir con la suma', () => {
		const invoice = {
			supplierId: ID,
			letter: 'A',
			number: '00004-00012845',
			date: '2026-11-05',
			dueDate: '2026-12-05',
			cae: null,
			purchaseOrderId: null,
			lines: [],
			concept: 'Gas de octubre',
			net: 10_000,
			nonTaxed: 0,
			vat: [{ rate: 'general', amount: 2_100 }],
			perceptions: [],
			total: 12_100,
			closesOrder: false,
			requestCredit: false
		}
		expect(
			createPurchaseInvoiceRequestSchema.safeParse({ invoice }).success
		).toBe(true)
		expect(
			createPurchaseInvoiceRequestSchema.safeParse({
				invoice: { ...invoice, total: 20_000 }
			}).success
		).toBe(false)
	})
})
