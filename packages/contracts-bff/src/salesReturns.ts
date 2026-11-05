import { z } from 'zod'

import { isoDateSchema } from '@henko-software/contracts-contacts'
import {
	createReturnRequestSchema,
	RETURN_REASONS,
	returnableSchema,
	returnSchema
} from '@henko-software/contracts-sales'

import { historyEventSchema, listParam } from './admin/common.js'

/**
 * Devoluciones (`/sales/returns`, flag `orders.returns`), armadas con
 * `sales`. Copian `henko-web/apps/web/src/data/returns/schema.ts`: el BFF
 * saca lo interno (local, alta) y pone nombres en el historial. El número
 * de una nota de crédito sin CAE es `null`.
 */
export const bffReturnSchema = returnSchema.omit({
	localId: true,
	createdAt: true
})
export type BffReturn = z.infer<typeof bffReturnSchema>

/** GET /api/returns?query=&reasons=&customerIds=&dateFrom=&dateTo= */
export const listBffReturnsQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	reasons: listParam(z.enum(RETURN_REASONS)),
	customerIds: listParam(z.uuid()),
	dateFrom: isoDateSchema.optional(),
	dateTo: isoDateSchema.optional()
})
export const listReturnsBffResponseSchema = z.object({
	returns: z.array(bffReturnSchema)
})
/** GET /api/returns/:id */
export const returnDetailBffResponseSchema = z.object({
	return: bffReturnSchema,
	history: z.array(historyEventSchema)
})
/** GET /api/customers/:id/returnable */
export const returnableBffResponseSchema = z.object({
	returnable: z.array(returnableSchema)
})
/** POST /api/returns — `ReturnInput` del front (`H-DV002` = `sales.return_exceeded`). */
export const createReturnBodySchema = createReturnRequestSchema.omit({
	id: true
})
export const returnBffResponseSchema = z.object({ return: bffReturnSchema })
