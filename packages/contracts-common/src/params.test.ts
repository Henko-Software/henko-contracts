import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { booleanParam, listParam } from './params.js'

describe('listParam', () => {
	const schema = z.object({
		ids: listParam(z.string()),
		on: listParam(booleanParam)
	})

	it('acepta coma y repetido; vacío no filtra', () => {
		expect(schema.parse({ ids: 'a,b', on: ['true', 'false'] })).toEqual({
			ids: ['a', 'b'],
			on: [true, false]
		})
		expect(schema.parse({ ids: '' })).toEqual({})
	})

	it('rechaza lo que no es del tipo', () => {
		expect(schema.safeParse({ on: 'si' }).success).toBe(false)
	})
})
