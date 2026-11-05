import { describe, expect, it } from 'vitest'

import {
	createAdjustmentRequestSchema,
	createChartAccountRequestSchema,
	LEDGER_INBOUND_EVENTS,
	listAccountsQuerySchema,
	salesDocumentIssuedEventSchema,
	treasuryReceiptIssuedEventSchema
} from './index.js'

const contactId = '0190f1a2-0000-7000-8000-000000000001'

describe('contrato de ledger', () => {
	it('un ajuste va en centavos enteros, con signo y nunca en cero', () => {
		const base = {
			party: 'customer',
			contactId,
			kind: 'opening_balance',
			date: '2026-11-01',
			dueDate: null,
			amount: 150_000,
			description: 'Saldo inicial'
		}
		expect(createAdjustmentRequestSchema.parse(base).companyId).toBeNull()
		expect(
			createAdjustmentRequestSchema.safeParse({ ...base, amount: -500 }).success
		).toBe(true)
		expect(
			createAdjustmentRequestSchema.safeParse({ ...base, amount: 0 }).success
		).toBe(false)
		expect(
			createAdjustmentRequestSchema.safeParse({ ...base, amount: 10.5 }).success
		).toBe(false)
	})

	it('los ids de una lista llegan como `a,b` o repetidos', () => {
		const other = '0190f1a2-0000-7000-8000-000000000002'
		expect(
			listAccountsQuerySchema.parse({
				party: 'supplier',
				contactIds: `${contactId},${other}`
			}).contactIds
		).toEqual([contactId, other])
	})

	it('un título del plan no se usa en comprobantes', () => {
		const account = {
			code: '1-0-00-0-000',
			name: 'ACTIVO',
			kind: 'title',
			parentId: null,
			isResult: false,
			systemManaged: false,
			uses: ['sales'],
			notes: null
		}
		expect(createChartAccountRequestSchema.safeParse(account).success).toBe(
			false
		)
		expect(
			createChartAccountRequestSchema.safeParse({ ...account, uses: [] })
				.success
		).toBe(true)
	})

	it('cada evento que se consume acota el tipo de comprobante', () => {
		const document = {
			id: 'inv-1',
			kind: 'invoice',
			contactId,
			companyId: null,
			letter: 'A',
			number: '0003-00012845',
			date: '2026-11-01',
			dueDate: '2026-11-30',
			description: null,
			currency: 'ARS',
			exchangeRate: 1,
			originalAmount: 100_000,
			amount: 100_000
		}
		expect(salesDocumentIssuedEventSchema.safeParse({ document }).success).toBe(
			true
		)
		expect(
			treasuryReceiptIssuedEventSchema.safeParse({ document }).success
		).toBe(false)
		expect(LEDGER_INBOUND_EVENTS['treasury.receipt.issued.v1'].party).toBe(
			'customer'
		)
	})
})
