import { describe, expect, it } from 'vitest'

import {
	ARCA_RECEIVER_CONDITION_LETTERS,
	ARCA_RECEIVER_VAT_CONDITION,
	authorizeVoucherRequestSchema,
	cuitDigitsSchema,
	isValidCuit,
	VAT_CONDITIONS
} from './index.js'

const base = {
	id: '0192b0a1-7c00-7000-8000-000000000001',
	localId: 'central',
	pointOfSale: 2,
	kind: 'invoice',
	letter: 'A',
	date: '2026-11-04',
	receiver: { vatCondition: 'RI', docType: 'CUIT', docNumber: '20123456786' },
	lines: [
		{
			quantity: 2,
			perUnit: 48,
			unitNetPrice: 1250.5,
			discountPct: 0,
			vatRate: 'general'
		}
	]
}

describe('contrato de fiscal', () => {
	it('completa los valores por defecto de un comprobante', () => {
		const parsed = authorizeVoucherRequestSchema.parse(base)
		expect(parsed.concept).toBe('products')
		expect(parsed.bonusPct).toBe(0)
		expect(parsed.related).toBeNull()
		expect(parsed.allowContingency).toBe(true)
	})

	it('no acepta un punto de venta fuera del rango de ARCA', () => {
		expect(
			authorizeVoucherRequestSchema.safeParse({ ...base, pointOfSale: 99999 })
				.success
		).toBe(false)
	})

	it('valida el dígito verificador del CUIT', () => {
		expect(isValidCuit('20-12345678-6')).toBe(true)
		expect(isValidCuit('20123456789')).toBe(false)
		expect(cuitDigitsSchema.safeParse('20-12345678-6').success).toBe(false)
	})

	it('toda condición con código de ARCA tiene las letras que acepta', () => {
		VAT_CONDITIONS.forEach(condition => {
			const id = ARCA_RECEIVER_VAT_CONDITION[condition]
			if (id !== null) expect(ARCA_RECEIVER_CONDITION_LETTERS[id]).toBeDefined()
		})
	})
})
