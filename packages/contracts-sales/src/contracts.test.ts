import { describe, expect, it } from 'vitest'

import {
	invoiceAuthorizationRequestedEventSchema,
	listOrdersQuerySchema,
	orderInputSchema,
	recordAuthorizationRequestSchema
} from './index.js'

const ID = '0192b0a1-7c00-7000-8000-0000000000a1'

describe('contrato de sales', () => {
	it('los filtros del listado de pedidos vienen como lista', () => {
		expect(
			listOrdersQuerySchema.parse({ stages: 'held,authorized', zones: ['A'] })
		).toMatchObject({
			stages: ['held', 'authorized'],
			zones: ['A'],
			limit: 500
		})
	})

	it('la entrega no puede ser antes del pedido', () => {
		const order = {
			customerId: ID,
			deliveryPlaceId: 'lugar-1',
			zone: null,
			orderedAt: '2026-11-05',
			deliveryDate: '2026-11-04',
			kind: 'sale',
			receptionMode: null,
			paymentTermId: ID,
			purchaseOrder: null,
			salespersonId: null,
			carrierId: null,
			bonusPct: 0,
			notes: { general: null, deliveryNote: null },
			lines: [
				{
					articleId: ID,
					presentationId: null,
					perUnit: 1,
					quantity: 2,
					unitNetPrice: 100,
					discountPct: 0,
					vatRate: 'general'
				}
			]
		}
		expect(orderInputSchema.safeParse(order).success).toBe(false)
		expect(
			orderInputSchema.safeParse({ ...order, deliveryDate: '2026-11-06' })
				.success
		).toBe(true)
	})

	it('la autorización anota CAE o el rechazo', () => {
		expect(
			recordAuthorizationRequestSchema.safeParse({
				status: 'rejected',
				errors: [{ code: 10015, message: 'CUIT inválido' }]
			}).success
		).toBe(true)
		expect(
			recordAuthorizationRequestSchema.safeParse({
				status: 'authorized',
				type: 'CAE',
				code: '1234',
				dueDate: '2026-11-15',
				pointOfSale: 2,
				number: 1
			}).success
		).toBe(false)
	})

	it('el pedido de CAE lleva el comprobante para fiscal', () => {
		const parsed = invoiceAuthorizationRequestedEventSchema.parse({
			invoiceId: ID,
			voucher: {
				id: ID,
				localId: 'central',
				pointOfSale: 2,
				kind: 'invoice',
				letter: 'B',
				date: '2026-11-05',
				receiver: { vatCondition: 'CF', docType: null, docNumber: '0' },
				lines: [
					{
						quantity: 1,
						perUnit: 1,
						unitNetPrice: 100,
						discountPct: 0,
						vatRate: 'general'
					}
				]
			}
		})
		expect(parsed.voucher.bonusPct).toBe(0)
	})
})
