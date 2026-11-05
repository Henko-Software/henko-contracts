import { describe, expect, it } from 'vitest'

import {
	articlePhotoRequestSchema,
	catalogLookupTableSchema,
	createDiscountScaleRequestSchema,
	listArticlesQuerySchema,
	priceListRequestSchema,
	priceTargetSchema,
	resolvePricesRequestSchema
} from './index.js'

const ID = '0192b0a1-7c00-7000-8000-0000000000a1'

describe('contrato de catalog', () => {
	it('los filtros del listado de artículos vienen como lista', () => {
		expect(
			listArticlesQuerySchema.parse({
				kinds: 'finished,resale',
				usage: ['sale', 'recipes']
			})
		).toMatchObject({
			kinds: ['finished', 'resale'],
			usage: ['sale', 'recipes']
		})
		expect(listArticlesQuerySchema.safeParse({ kinds: 'otro' }).success).toBe(
			false
		)
	})

	it('los tramos de una escala van encadenados', () => {
		const base = { name: 'Escala', unit: 'amount', customerIds: [] }
		const ok = createDiscountScaleRequestSchema.safeParse({
			...base,
			tiers: [
				{ from: 0, to: 100, percent: 0 },
				{ from: 100, to: null, percent: 5 }
			]
		})
		expect(ok.success).toBe(true)
		for (const tiers of [
			[
				{ from: 0, to: 100, percent: 0 },
				{ from: 120, to: null, percent: 5 }
			],
			[
				{ from: 0, to: null, percent: 0 },
				{ from: 100, to: 200, percent: 5 }
			],
			[{ from: 10, to: 5, percent: 1 }]
		]) {
			expect(
				createDiscountScaleRequestSchema.safeParse({ ...base, tiers }).success
			).toBe(false)
		}
	})

	it('el destino de un precio es un artículo o un agrupamiento', () => {
		expect(
			priceTargetSchema.safeParse({ kind: 'group', groupId: ID }).success
		).toBe(true)
		expect(
			priceTargetSchema.safeParse({ kind: 'group', articleId: ID }).success
		).toBe(false)
	})

	it('resolver: sin fecha es ahora y sin cliente no hay escalas', () => {
		expect(
			resolvePricesRequestSchema.parse({
				priceListId: ID,
				items: [{ articleId: ID, presentationId: null }]
			})
		).toMatchObject({ at: null, customerId: null })
	})

	it('la foto viaja en base64 y sólo de los tipos que se guardan', () => {
		expect(
			articlePhotoRequestSchema.safeParse({
				contentType: 'image/webp',
				data: 'UklGRg=='
			}).success
		).toBe(true)
		expect(
			articlePhotoRequestSchema.safeParse({
				contentType: 'image/gif',
				data: 'UklGRg=='
			}).success
		).toBe(false)
		expect(
			articlePhotoRequestSchema.safeParse({
				contentType: 'image/webp',
				data: 'data:image/webp;base64,UklGRg=='
			}).success
		).toBe(false)
	})

	it('categorías y envases son las tablas auxiliares de catalog', () => {
		expect(catalogLookupTableSchema.options).toEqual([
			'article_categories',
			'containers'
		])
	})

	it('la lista principal se marca al crear o editar, y es opcional', () => {
		expect(priceListRequestSchema.parse({ name: 'A' })).toEqual({ name: 'A' })
		expect(
			priceListRequestSchema.parse({ name: 'A', isBase: true }).isBase
		).toBe(true)
	})
})
