import { describe, expect, it } from 'vitest'

import {
	absenceInputSchema,
	dniDigits,
	employeeInputSchema,
	listEmployeesQuerySchema
} from './index.js'

const EMPLOYEE = '0192b0a1-7c00-7000-8000-0000000000e1'

const input = {
	fileNumber: '0042',
	hiredAt: '2026-06-01',
	lastNames: 'Pérez',
	firstNames: 'Ana',
	docType: 'CUIL' as const,
	docNumber: '20-12345678-6',
	category: 'administrative',
	department: 'administration',
	birthDate: null,
	schedule: 'full',
	contact: {
		phone1: null,
		phone2: null,
		fax: null,
		email: null,
		address: null,
		city: null,
		province: null,
		postalCode: null
	},
	notes: null,
	workplace: { kind: 'office' as const, storeId: null },
	exit: null,
	emergencyContact: null,
	userId: null,
	papers: { foodHandler: null, driverLicense: null, preEmployment: null }
}

describe('contrato de people', () => {
	it('valida CUIL, DNI, local y egreso', () => {
		expect(employeeInputSchema.safeParse(input).success).toBe(true)
		expect(
			employeeInputSchema.safeParse({ ...input, docNumber: '20-12345678-5' })
				.success
		).toBe(false)
		expect(
			employeeInputSchema.safeParse({
				...input,
				docType: 'DNI',
				docNumber: '123'
			}).success
		).toBe(false)
		expect(
			employeeInputSchema.safeParse({
				...input,
				workplace: { kind: 'store', storeId: null }
			}).success
		).toBe(false)
		expect(
			employeeInputSchema.safeParse({
				...input,
				exit: { date: '2026-05-01', reason: 'resignation', note: null }
			}).success
		).toBe(false)
	})

	it('el DNI está adentro del CUIL', () => {
		expect(dniDigits('20-28444555-5')).toBe('28444555')
		expect(dniDigits('28.444.555')).toBe('28444555')
	})

	it('una ausencia no termina antes de empezar', () => {
		const absence = {
			employeeId: EMPLOYEE,
			kind: 'vacation',
			from: '2026-12-10',
			to: '2026-12-01',
			note: null
		}
		expect(absenceInputSchema.safeParse(absence).success).toBe(false)
	})

	it('los filtros de la lista aceptan listas separadas por coma', () => {
		const parsed = listEmployeesQuerySchema.parse({
			states: 'working,leaving',
			papers: ['due']
		})
		expect(parsed.states).toEqual(['working', 'leaving'])
		expect(parsed.papers).toEqual(['due'])
	})
})
