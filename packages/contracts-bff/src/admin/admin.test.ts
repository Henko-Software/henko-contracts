import { describe, expect, it } from 'vitest'

import {
	bffPriceSchema,
	customerInputSchema,
	listBffArticlesQuerySchema,
	listCustomersQuerySchema,
	listSuppliersQuerySchema,
	salespersonRefSchema,
	setStatusBodySchema,
	UNASSIGNED_SALESPERSON_ID
} from './index.js'

describe('contrato de Administración del BFF', () => {
	it('los filtros aceptan `a,b` y `?x=a&x=b`', () => {
		const query = listCustomersQuerySchema.parse({
			statuses: 'active',
			provinces: ['CF', 'BA'],
			salespersonIds: `${UNASSIGNED_SALESPERSON_ID}`,
			stoppedBuying: 'true'
		})
		expect(query).toMatchObject({
			statuses: ['active'],
			provinces: ['CF', 'BA'],
			salespersonIds: ['sp-000001'],
			stoppedBuying: true
		})
		expect(
			listSuppliersQuerySchema.parse({ approved: 'true,false' }).approved
		).toEqual([true, false])
	})

	it('el vendedor es un UUID o «Sin asignar»', () => {
		expect(salespersonRefSchema.safeParse('sp-000001').success).toBe(true)
		expect(salespersonRefSchema.safeParse('sp-000002').success).toBe(false)
		expect(
			salespersonRefSchema.safeParse('0192b0a1-7c00-7000-8000-0000000000aa')
				.success
		).toBe(true)
	})

	it('la ficha de cliente pide un CUIT válido', () => {
		const result = customerInputSchema.safeParse({ docType: 'CUIT' })
		expect(result.success).toBe(false)
	})

	it('las masivas piden al menos un id', () => {
		expect(
			setStatusBodySchema.safeParse({ ids: [], status: 'deleted' }).success
		).toBe(false)
	})

	it('padrón: CUIT de 11 dígitos y provincia que puede no venir', async () => {
		const { cuitDigitsParamSchema, taxRegistryLookupResponseSchema } =
			await import('./index.js')
		expect(cuitDigitsParamSchema.safeParse('30712345663').success).toBe(true)
		expect(cuitDigitsParamSchema.safeParse('30-71234566-3').success).toBe(false)
		const entry = {
			cuit: '30712345663',
			personType: 'company',
			legalName: 'EMPRESA SA',
			vatCondition: 'RI',
			activity: 'Panadería',
			address: 'Av. Siempre Viva 742',
			city: 'CABA',
			province: null,
			postalCode: '1000',
			active: true,
			invoiceKind: 'standard',
			apoc: false
		}
		expect(
			taxRegistryLookupResponseSchema.parse({
				entry,
				fetchedAt: '2026-11-04T12:00:00.000Z'
			}).entry?.province
		).toBeNull()
	})

	it('catálogo: el autor de un precio llega con nombre y los filtros como lista', () => {
		const id = '0192b0a1-7c00-7000-8000-0000000000a1'
		expect(
			bffPriceSchema.safeParse({
				id,
				priceListId: id,
				target: { kind: 'article', articleId: id },
				presentationId: null,
				netPrice: 95041.32,
				fixedPerUnit: false,
				unitCost: null,
				validFrom: '2026-11-01T03:00:00.000Z',
				validTo: null,
				updatedAt: '2026-11-01T03:00:00.000Z',
				updatedBy: 'Ana'
			}).success
		).toBe(true)
		expect(
			listBffArticlesQuerySchema.parse({ usage: 'sale,purchase' }).usage
		).toEqual(['sale', 'purchase'])
	})
})
