import { z } from 'zod'

import {
	airesCodeSchema,
	contactInfoSchema,
	customerProfileInputSchema,
	docTypeSchema,
	isoDateSchema,
	lookupCodeSchema,
	provinceSchema,
	recordStatusSchema,
	refineDocNumber,
	vatConditionSchema
} from '@henko-software/contracts-contacts'

import {
	baseContactInfoSchema,
	booleanParam,
	historyEventSchema,
	listParam,
	recordIdSchema,
	statusesParam,
	UNASSIGNED_CARRIER_ID,
	UNASSIGNED_SALESPERSON_ID
} from './common.js'

/**
 * Clientes (`/admin/customers`). Un cliente es un contacto de `contacts`
 * con rol `customer`: lo común del contacto más el perfil del rol, plano
 * como lo usa el front (`henko-web/apps/web/src/data/customers/schema.ts`).
 * `status` es el del rol (dejar de ser cliente no da de baja al contacto).
 */

const profile = customerProfileInputSchema.shape

/** Vendedor: el UUID de `contacts` o `sp-000001` («Sin asignar»). */
export const salespersonRefSchema = z.union([
	z.uuid(),
	z.literal(UNASSIGNED_SALESPERSON_ID)
])
/** Transportista: el UUID de `contacts`, `ca-000001` («Sin asignar») o `null`. */
export const carrierRefSchema = z
	.union([z.uuid(), z.literal(UNASSIGNED_CARRIER_ID)])
	.nullable()

const customerFields = {
	expeditionSheetCode: profile.expeditionSheetCode,
	legalName: z.string().trim().min(1).max(160),
	tradeName: z.string().trim().min(1).max(160),
	docType: docTypeSchema,
	docNumber: z.string().max(20),
	vatCondition: vatConditionSchema,
	customerType: profile.customerType,
	salesChannel: profile.salesChannel,
	joinedAt: profile.joinedAt,
	contact: baseContactInfoSchema.extend({
		website: contactInfoSchema.shape.website,
		billingEmail: profile.billingEmail,
		country: contactInfoSchema.shape.country,
		region: contactInfoSchema.shape.region,
		portalAccess: profile.portalAccess
	}),
	carrierId: carrierRefSchema,
	commercial: profile.commercial.extend({
		salespersonId: salespersonRefSchema
	}),
	deliveryPlaces: profile.deliveryPlaces,
	groupIds: profile.groupIds,
	notes: profile.notes,
	location: profile.location
}

export const customerSchema = z.object({
	id: recordIdSchema,
	code: airesCodeSchema,
	...customerFields,
	lastSaleAt: isoDateSchema.nullable(),
	status: recordStatusSchema
})
export type Customer = z.infer<typeof customerSchema>

/** POST /api/customers · PUT /api/customers/:id — la ficha entera. */
export const customerInputSchema = z
	.object(customerFields)
	.superRefine((customer, context) => refineDocNumber(customer, context))
export type CustomerInput = z.infer<typeof customerInputSchema>

/**
 * Resumen de la cuenta corriente. No es de `contacts`: sale de Ventas y
 * Tesorería, que todavía no existen. Hasta entonces viene `null`.
 */
export const customerAccountSchema = z.object({
	balance: z.number().int(),
	overdue: z.number().int().min(0),
	oldestOverdueDays: z.number().int().min(0),
	lastPaymentAt: isoDateSchema.nullable(),
	avgDaysLate: z.number().int().min(0).nullable(),
	orderEveryDays: z.number().int().min(1).nullable()
})

export const customerListItemSchema = customerSchema.extend({
	account: customerAccountSchema.nullable()
})

export const CUSTOMER_ACCOUNT_STATES = [
	'up_to_date',
	'overdue',
	'blocked'
] as const
export const PAYMENT_BEHAVIORS = ['good', 'late', 'risk', 'unknown'] as const

/**
 * GET /api/customers — todos los que cumplen (sin paginar, como pide el
 * front hoy), ordenados por nombre. Y entre filtros, O dentro de cada uno.
 * Los que dependen de la cuenta corriente (`accountStates`, `stoppedBuying`,
 * `paymentBehaviors`) se resuelven con la cuenta que haya (hoy ninguna: sin
 * deuda ni historia de pagos).
 */
export const listCustomersQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	statuses: statusesParam,
	customerTypes: listParam(lookupCodeSchema),
	salesChannels: listParam(lookupCodeSchema),
	provinces: listParam(provinceSchema),
	accountStates: listParam(z.enum(CUSTOMER_ACCOUNT_STATES)),
	priceListIds: listParam(z.string().min(1).max(60)),
	salespersonIds: listParam(salespersonRefSchema),
	stoppedBuying: booleanParam.optional(),
	paymentBehaviors: listParam(z.enum(PAYMENT_BEHAVIORS))
})
export type ListCustomersQuery = z.output<typeof listCustomersQuerySchema>

export const listCustomersResponseSchema = z.object({
	customers: z.array(customerListItemSchema)
})

/** GET /api/customers/:id — la ficha. `movements` vacío hasta tener cuenta corriente. */
export const customerDetailResponseSchema = z.object({
	customer: customerSchema,
	account: customerAccountSchema.nullable(),
	movements: z.array(z.never()),
	history: z.array(historyEventSchema)
})

/** POST /api/customers · PUT /api/customers/:id */
export const customerResponseSchema = z.object({ customer: customerSchema })

/** POST /api/customers/financial-block. 204. */
export const setFinancialBlockBodySchema = z.object({
	ids: z.array(recordIdSchema).min(1).max(500),
	blocked: z.boolean()
})

/** POST /api/customers/salesperson. `sp-000001` = sin asignar. 204. */
export const setSalespersonBodySchema = z.object({
	ids: z.array(recordIdSchema).min(1).max(500),
	salespersonId: salespersonRefSchema
})

/** GET /api/customers/by-doc/:digits — el cliente con ese documento, o `null`. */
export const customerByDocResponseSchema = z.object({
	customer: customerSchema.nullable()
})
