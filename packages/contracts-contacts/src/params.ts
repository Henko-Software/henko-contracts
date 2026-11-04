import { z } from 'zod'

/**
 * Filtro de un listado en la query: `a,b` o `?x=a&x=b` → `['a', 'b']`.
 * Vacío o ausente = sin filtrar.
 */
export const listParam = <T extends z.ZodType>(item: T) =>
	z.preprocess(value => {
		if (value === undefined || value === '') return undefined
		const values = Array.isArray(value) ? value : [value]
		return values
			.flatMap(v => (typeof v === 'string' ? v.split(',') : [v]))
			.filter(v => v !== '')
	}, z.array(item).max(100).optional())

/** `true` / `false` en la query. */
export const booleanParam = z
	.enum(['true', 'false'])
	.transform(v => v === 'true')
