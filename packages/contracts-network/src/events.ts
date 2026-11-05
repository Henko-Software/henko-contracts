import { z } from 'zod'

import { networkIdSchema, refIdSchema } from './common.js'
import { siteStatusSchema } from './sites.js'

/**
 * Eventos de network (stream `NETWORK`, por el outbox, con el id en
 * `Nats-Msg-Id`).
 */
export const NETWORK_EVENTS = {
	siteCreated: 'network.site.created.v1',
	siteUpdated: 'network.site.updated.v1',
	/** Pasó de estado. A «approved» es la señal para convertirlo en local. */
	siteMoved: 'network.site.moved.v1',
	storeChanged: 'network.store.changed.v1'
} as const

export const siteEventPayloadSchema = z.object({
	site: z.object({
		id: networkIdSchema,
		addressId: z.string(),
		street: z.string(),
		status: siteStatusSchema
	}),
	from: siteStatusSchema.nullable(),
	note: z.string().nullable()
})
export type SiteEventPayload = z.infer<typeof siteEventPayloadSchema>

export const storeChangedEventSchema = z.object({
	store: z.object({
		id: networkIdSchema,
		customerId: refIdSchema,
		status: z.enum(['active', 'deleted'])
	})
})
