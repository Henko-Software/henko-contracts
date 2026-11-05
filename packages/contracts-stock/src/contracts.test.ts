import { describe, expect, it } from 'vitest'

import {
	adjustmentInputSchema,
	listMovementsQuerySchema,
	productionPostingRequestSchema,
	transferInputSchema
} from './index.js'

const ID = '0192b0a1-7c00-7000-8000-0000000000a1'

describe('contrato de stock', () => {
	it('una transferencia va a otra ubicación', () => {
		const transfer = {
			articleId: 'art-1',
			lot: null,
			fromId: 'ub-n-mp',
			toId: 'ub-n-mp',
			quantity: 2,
			note: null
		}
		expect(transferInputSchema.safeParse(transfer).success).toBe(false)
		expect(
			transferInputSchema.safeParse({ ...transfer, toId: 'ub-n-coc' }).success
		).toBe(true)
	})

	it('un ajuste «otro» pide la nota y no es cero', () => {
		const base = {
			articleId: 'art-1',
			locationId: 'ub-n-mp',
			lot: null,
			expiry: null,
			quantity: -1,
			reason: 'other',
			note: null
		}
		expect(adjustmentInputSchema.safeParse(base).success).toBe(false)
		expect(
			adjustmentInputSchema.safeParse({ ...base, note: 'Se cayó' }).success
		).toBe(true)
		expect(
			adjustmentInputSchema.safeParse({
				...base,
				quantity: 0,
				reason: 'damaged'
			}).success
		).toBe(false)
	})

	it('lo de producción es de una orden de producción y mueve algo', () => {
		const posting = {
			id: ID,
			date: '2026-11-05',
			ref: { kind: 'productionOrder', id: 'op-1', number: '0001' },
			consumed: [
				{ articleId: 'harina', locationId: null, lot: null, quantity: 3 }
			],
			produced: []
		}
		const parsed = productionPostingRequestSchema.parse(posting)
		expect(parsed.allowNegative).toBe(false)
		expect(
			productionPostingRequestSchema.safeParse({
				...posting,
				ref: { ...posting.ref, kind: 'count' }
			}).success
		).toBe(false)
		expect(
			productionPostingRequestSchema.safeParse({ ...posting, consumed: [] })
				.success
		).toBe(false)
	})

	it('los filtros de movimientos aceptan listas por coma', () => {
		const query = listMovementsQuerySchema.parse({
			lots: 'L1,L2',
			withPieces: 'true'
		})
		expect(query.lots).toEqual(['L1', 'L2'])
		expect(query.withPieces).toBe(true)
		expect(query.limit).toBe(1000)
	})
})

describe('transferencia de un retiro', () => {
	it('sólo acepta `ref` de un retiro', async () => {
		const { createTransferRequestSchema } = await import('./index.js')
		const transfer = {
			articleId: 'empanada',
			lot: '05-11-26',
			fromId: 'ub-n-cong',
			toId: 'ub-ret',
			quantity: 10,
			note: null
		}
		const ref = { kind: 'recall', id: 'r-1', number: '0001' }
		expect(
			createTransferRequestSchema.safeParse({ transfer, ref }).success
		).toBe(true)
		expect(
			createTransferRequestSchema.safeParse({
				transfer,
				ref: { ...ref, kind: 'count' }
			}).success
		).toBe(false)
	})
})
