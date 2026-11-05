import { describe, expect, it } from 'vitest'

import {
	bffBankAccountSchema,
	bffPaymentOrderInputSchema,
	bffReceiptInputSchema
} from './index.js'

const ID = '0192b0a1-7c00-7000-8000-0000000000a1'

describe('tesorería en el BFF', () => {
	it('el recibo del front: no aplica más de lo que entró', () => {
		const input = {
			customerId: ID,
			date: '2026-11-05',
			values: [
				{ kind: 'cash', amount: 100, bankAccountId: null, cheque: null }
			],
			withholdings: [],
			applications: [{ movementId: ID, number: '0002-00000001', amount: 100 }],
			notes: null
		}
		expect(bffReceiptInputSchema.safeParse(input).success).toBe(true)
		expect(
			bffReceiptInputSchema.safeParse({
				...input,
				applications: [{ ...input.applications[0], amount: 101 }]
			}).success
		).toBe(false)
	})

	it('la orden del front: el efectivo va con los billetes', () => {
		const order = {
			supplierId: ID,
			date: '2026-11-05',
			applications: [],
			values: [
				{
					kind: 'cash',
					amount: 200_000,
					bankAccountId: null,
					chequeId: null,
					echeq: null
				}
			],
			notes: null
		}
		expect(bffPaymentOrderInputSchema.safeParse(order).success).toBe(false)
		expect(
			bffPaymentOrderInputSchema.safeParse({
				...order,
				values: [{ ...order.values[0], bills: [{ face: 2000, count: 1 }] }]
			}).success
		).toBe(true)
	})

	it('la cuenta bancaria sale con id y estado, y las reglas por entidad', () => {
		const account = {
			id: 'x',
			status: 'active',
			airesId: null,
			company: 'big_pizza',
			code: 'FIN-01',
			description: 'Financiera',
			entityType: 'financial',
			institutionId: 'galicia',
			branch: null,
			accountType: 'checking',
			currency: 'ARS',
			accountNumber: null,
			cbu: null,
			alias: null,
			acceptsChecks: false,
			ledger: { bank: null, checksIssued: null, checksInTransit: null }
		}
		expect(bffBankAccountSchema.safeParse(account).success).toBe(false)
		expect(
			bffBankAccountSchema.safeParse({ ...account, institutionId: null })
				.success
		).toBe(true)
	})
})
