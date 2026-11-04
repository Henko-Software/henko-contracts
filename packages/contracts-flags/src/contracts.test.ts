import { describe, expect, it } from 'vitest'

import {
	effectiveFlagsSchema,
	FLAG_CATALOG,
	FLAG_KEYS,
	flagValuesSchema
} from './index.js'

describe('catálogo de flags', () => {
	it('el padre de cada clave es su prefijo, y existe', () => {
		for (const key of FLAG_KEYS) {
			const { parent } = FLAG_CATALOG[key]
			const prefix = key.includes('.')
				? key.slice(0, key.lastIndexOf('.'))
				: null
			expect(parent, key).toBe(prefix)
		}
	})

	it('los valores guardados son parciales; los efectivos, completos', () => {
		expect(flagValuesSchema.parse({ orders: true })).toEqual({ orders: true })
		expect(flagValuesSchema.safeParse({ ventas: true }).success).toBe(false)
		expect(effectiveFlagsSchema.safeParse({ orders: true }).success).toBe(false)
		const all = Object.fromEntries(FLAG_KEYS.map(k => [k, false]))
		expect(effectiveFlagsSchema.safeParse(all).success).toBe(true)
	})
})
