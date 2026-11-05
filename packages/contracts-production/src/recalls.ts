import { z } from 'zod'

import {
	actorRefSchema,
	articleIdSchema,
	historyEntrySchema,
	lotSchema,
	productionIdSchema,
	refIdSchema
} from './common.js'
import { traceSourceSchema } from './lots.js'
import { stockLocationSchema } from './stock.js'

/**
 * Retiros y simulacros de un lote. Copia
 * `henko-web/apps/web/src/data/traceability/schema.ts`. Un retiro pasa lo
 * que queda en planta a la ubicación `hold` (por evento, lo anota stock);
 * un simulacro no mueve nada. Se guardan más que la vida útil (BPM 7.7).
 */

export const RECALL_KINDS = ['recall', 'drill'] as const
export const recallKindSchema = z.enum(RECALL_KINDS)
export type RecallKind = z.infer<typeof recallKindSchema>

/** Un local que recibió algo del lote, y si ya se lo ubicó. */
export const recallStoreSchema = z.object({
	customerId: refIdSchema,
	reachedAt: z.iso.datetime().nullable()
})

export const recallSchema = z.object({
	id: productionIdSchema,
	/** «0001». */
	number: z.string().regex(/^\d{4,}$/),
	kind: recallKindSchema,
	articleId: articleIdSchema,
	lot: lotSchema,
	/** Por qué se retira; en un simulacro, opcional. */
	reason: z.string().trim().max(200).nullable(),
	startedAt: z.iso.datetime(),
	startedBy: actorRefSchema,
	closedAt: z.iso.datetime().nullable(),
	closedBy: actorRefSchema.nullable(),
	/** Lo que estaba en planta al empezar, en kilos: está ubicado. */
	heldKg: z.number().min(0),
	/** Lo que había salido a los locales al empezar, en kilos. */
	shippedKg: z.number().min(0),
	stores: z.array(recallStoreSchema)
})
export type Recall = z.infer<typeof recallSchema>

/** Empezar un retiro o un simulacro de un lote. */
export const recallInputSchema = z
	.object({
		articleId: articleIdSchema,
		lot: lotSchema,
		kind: recallKindSchema,
		reason: z.string().trim().max(200).nullable()
	})
	.refine(input => input.kind === 'drill' || Boolean(input.reason), {
		path: ['reason'],
		message: 'Contá por qué se retira.'
	})
export type RecallInput = z.infer<typeof recallInputSchema>

/**
 * POST /internal/recalls. Además del pedido, lo que trae quien llama: la
 * trazabilidad (`source`) y las ubicaciones (lo retenido va a la `hold`).
 * Con `id` repetido no se duplica.
 */
export const startRecallRequestSchema = z.object({
	id: productionIdSchema.optional(),
	recall: recallInputSchema,
	source: traceSourceSchema,
	locations: z.array(stockLocationSchema).max(500)
})
export type StartRecallRequest = z.input<typeof startRecallRequestSchema>

/** PUT /internal/recalls/:id/stores/:customerId */
export const markRecallStoreRequestSchema = z.object({ reached: z.boolean() })

/** GET /internal/recalls: los en curso primero, después del más nuevo al más viejo. */
export const listRecallsResponseSchema = z.object({
	recalls: z.array(recallSchema)
})
export const recallResponseSchema = z.object({ recall: recallSchema })
export const recallDetailResponseSchema = z.object({
	recall: recallSchema,
	history: z.array(historyEntrySchema)
})
