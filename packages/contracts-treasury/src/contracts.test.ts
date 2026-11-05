import { describe, expect, it } from 'vitest'

import {
	bankAccountInputSchema,
	createPaymentOrderRequestSchema,
	createReceiptRequestSchema,
	isValidCbu,
	listChequesQuerySchema
} from './index.js'

const ID = '0192b0a1-7c00-7000-8000-0000000000a1'
const OTHER = '0192b0a1-7c00-7000-8000-0000000000a2'

const receipt = {
	customer: { id: ID, localId: null, label: 'Caballito' },
	date: '2026-11-05',
	values: [
		{ kind: 'cash', amount: 1000, bankAccountId: null, cheque: null },
		{
			kind: 'cheque',
			amount: 500,
			bankAccountId: null,
			cheque: { bank: 'Nación', number: '12345678', payDate: '2026-11-10' }
		}
	],
	withholdings: [],
	applications: [{ movementId: OTHER, number: '0002-00000001', amount: 1500 }],
	notes: null,
	openItems: [{ movementId: OTHER, pending: 2000 }]
}

describe('contrato de treasury', () => {
	it('un recibo no aplica más de lo que entró', () => {
		expect(createReceiptRequestSchema.safeParse(receipt).success).toBe(true)
		expect(
			createReceiptRequestSchema.safeParse({
				...receipt,
				applications: [{ ...receipt.applications[0], amount: 1501 }]
			}).success
		).toBe(false)
	})

	it('un cheque del recibo lleva sus datos y una transferencia su cuenta', () => {
		const values = [
			{ kind: 'transfer', amount: 10, bankAccountId: null, cheque: null }
		]
		expect(
			createReceiptRequestSchema.safeParse({
				...receipt,
				values,
				applications: []
			}).success
		).toBe(false)
	})

	it('la orden de pago alcanza para lo que aplica y no endosa dos veces un cheque', () => {
		const order = {
			supplier: { id: ID, label: 'Molino' },
			date: '2026-11-05',
			applications: [
				{ movementId: OTHER, number: '0001-00000001', amount: 900 }
			],
			values: [
				{
					kind: 'endorsed',
					amount: 500,
					bankAccountId: null,
					chequeId: ID,
					echeq: null
				},
				{
					kind: 'cash',
					amount: 500,
					bankAccountId: null,
					chequeId: null,
					echeq: null,
					bills: [{ face: 5, count: 1 }]
				}
			],
			notes: null,
			openItems: []
		}
		expect(createPaymentOrderRequestSchema.safeParse(order).success).toBe(true)
		expect(
			createPaymentOrderRequestSchema.safeParse({
				...order,
				values: [order.values[0], order.values[0]]
			}).success
		).toBe(false)
	})

	it('en dólares: cotización, sin cheques y lo aplicado en pesos', () => {
		const usd = {
			...receipt,
			currency: 'USD',
			exchangeRate: 1000,
			values: [{ kind: 'cash', amount: 2, bankAccountId: null, cheque: null }],
			applications: [
				{ movementId: OTHER, number: '0002-00000001', amount: 2000 }
			]
		}
		expect(createReceiptRequestSchema.safeParse(usd).success).toBe(true)
		expect(
			createReceiptRequestSchema.safeParse({
				...usd,
				applications: [{ ...usd.applications[0], amount: 2001 }]
			}).success
		).toBe(false)
		expect(
			createReceiptRequestSchema.safeParse({ ...usd, values: receipt.values })
				.success
		).toBe(false)
		expect(
			createReceiptRequestSchema.safeParse({ ...receipt, exchangeRate: 2 })
				.success
		).toBe(false)
		expect(createReceiptRequestSchema.parse(receipt)).toMatchObject({
			currency: 'ARS',
			exchangeRate: 1
		})
	})

	it('la orden de pago trae los impuestos del proveedor o nada', () => {
		const parsed = createPaymentOrderRequestSchema.parse({
			supplier: { id: ID, label: 'Molino' },
			date: '2026-11-05',
			applications: [],
			values: [
				{
					kind: 'transfer',
					amount: 10,
					bankAccountId: ID,
					chequeId: null,
					echeq: null
				}
			],
			notes: null,
			openItems: []
		})
		expect(parsed.supplier.tax).toEqual({
			vatCondition: null,
			incomeTaxWithholding: null,
			incomeTaxConcept: null
		})
		expect(parsed.withholdingExempt).toEqual([])
	})

	it('el CBU tiene que tener los verificadores bien', () => {
		expect(isValidCbu('0110599520000001235579')).toBe(true)
		expect(isValidCbu('0110599520000001235578')).toBe(false)
		expect(
			bankAccountInputSchema.safeParse({
				airesId: null,
				company: 'big_pizza',
				code: 'FIN-01',
				description: 'Financiera',
				entityType: 'financial',
				institutionId: null,
				branch: null,
				accountType: 'checking',
				currency: 'ARS',
				accountNumber: null,
				cbu: null,
				alias: null,
				acceptsChecks: false,
				ledger: { bank: null, checksIssued: null, checksInTransit: null }
			}).success
		).toBe(true)
	})

	it('los filtros de cheques vienen como lista', () => {
		expect(
			listChequesQuerySchema.parse({ statuses: 'in_portfolio,deposited' })
		).toMatchObject({ statuses: ['in_portfolio', 'deposited'] })
	})
})
