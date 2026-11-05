import { describe, expect, it } from 'vitest'

import {
	createContactRequestSchema,
	createPaymentTermRequestSchema,
	cuitSchema,
	DEFAULT_CONTACT_KIND,
	docTakenDetailsSchema,
	isValidCbu,
	listContactsQuerySchema
} from './index.js'

const info = {
	phone1: null,
	phone2: null,
	fax: null,
	email: null,
	website: null,
	address: null,
	streetNumber: null,
	floor: null,
	city: null,
	province: null,
	postalCode: null,
	country: 'AR',
	region: null
}

describe('contrato de contacts', () => {
	it('CUIT con dígito verificador', () => {
		expect(cuitSchema.safeParse('20-12345678-6').success).toBe(true)
		expect(cuitSchema.safeParse('20-12345678-9').success).toBe(false)
		expect(cuitSchema.safeParse('20123456786').success).toBe(false)
	})

	it('CBU con los dos verificadores', () => {
		expect(isValidCbu('2850590940090418135201')).toBe(true)
		expect(isValidCbu('2850590940090418135202')).toBe(false)
	})

	it('un alta con un CUIT mal escrito no pasa; con DNI es texto libre', () => {
		const base = {
			kind: 'person' as const,
			name: 'Ana',
			legalName: null,
			docType: 'CUIT' as const,
			docNumber: '20-12345678-9',
			vatCondition: null,
			contact: info,
			localId: null,
			roles: [{ role: 'employee' as const, profile: {} }]
		}
		expect(createContactRequestSchema.safeParse(base).success).toBe(false)
		expect(
			createContactRequestSchema.safeParse({
				...base,
				docType: 'DNI',
				docNumber: '12.345.678'
			}).success
		).toBe(true)
	})

	it('sin `kind`, el alta es de una empresa (decisión 19)', () => {
		const parsed = createContactRequestSchema.parse({
			name: 'Ana',
			legalName: null,
			docType: null,
			docNumber: null,
			vatCondition: null,
			contact: info,
			localId: null,
			roles: [{ role: 'employee' as const, profile: {} }]
		})
		expect(DEFAULT_CONTACT_KIND).toBe('company')
		expect(parsed.kind).toBe('company')
	})

	it('CUIT repetido: el existente puede no mostrarse (decisión 18)', () => {
		expect(
			docTakenDetailsSchema.safeParse({
				fields: { docNumber: 'Ya existe.' },
				existing: null
			}).success
		).toBe(true)
	})

	it('no acepta dos veces el mismo rol', () => {
		const result = createContactRequestSchema.safeParse({
			kind: 'company',
			name: 'X',
			legalName: null,
			docType: null,
			docNumber: null,
			vatCondition: null,
			contact: info,
			localId: null,
			roles: [
				{ role: 'franchise', profile: {} },
				{ role: 'franchise', profile: {} }
			]
		})
		expect(result.success).toBe(false)
	})

	it('los filtros de la query aceptan coma o repetidos', () => {
		const query = listContactsQuerySchema.parse({
			roles: 'customer,supplier',
			provinces: ['CF', 'BA'],
			approved: 'true'
		})
		expect(query.roles).toEqual(['customer', 'supplier'])
		expect(query.provinces).toEqual(['CF', 'BA'])
		expect(query.approved).toEqual([true])
		expect(query.limit).toBe(100)
	})

	it('condición de pago: suman 100 % en centésimos y sin días repetidos', () => {
		const base = {
			legacyCodes: { customers: [], suppliers: [] },
			description: '30-60-90',
			scopes: ['customers' as const],
			currentAccount: true,
			customerAccountCode: '1-1-31-1-001',
			supplierAccountCode: null
		}
		const ok = createPaymentTermRequestSchema.safeParse({
			...base,
			installments: [
				{ percent: 33.33, days: 30 },
				{ percent: 33.33, days: 60 },
				{ percent: 33.34, days: 90 }
			]
		})
		expect(ok.success).toBe(true)
		const sameDay = createPaymentTermRequestSchema.safeParse({
			...base,
			installments: [
				{ percent: 50, days: 30 },
				{ percent: 50, days: 30 }
			]
		})
		expect(sameDay.success).toBe(false)
	})
})
