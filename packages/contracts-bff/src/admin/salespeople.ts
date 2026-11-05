import { z } from 'zod'

import {
	airesCodeSchema,
	docTypeSchema,
	recordStatusSchema,
	salespersonProfileInputSchema
} from '@henko-software/contracts-contacts'

import {
	baseContactInfoSchema,
	historyEventSchema,
	recordIdSchema,
	statusesParam
} from './common.js'

/**
 * Vendedores (`/admin/salespeople`): contactos con rol `salesperson`, con
 * los datos de contacto planos en la raíz como
 * `henko-web/apps/web/src/data/salespeople/schema.ts`.
 */

const profile = salespersonProfileInputSchema.shape

const salespersonFields = {
	name: z.string().trim().min(1).max(160),
	alias: profile.alias,
	legalName: z.string().trim().max(160).nullable(),
	docType: docTypeSchema,
	docNumber: z.string().max(20).nullable(),
	joinedAt: profile.joinedAt,
	zone: profile.zone,
	commissionPct: profile.commissionPct,
	commissionBase: profile.commissionBase,
	commissionByCategory: profile.commissionByCategory,
	notes: profile.notes,
	...baseContactInfoSchema.shape
}

export const salespersonSchema = z.object({
	id: recordIdSchema,
	code: airesCodeSchema,
	...salespersonFields,
	status: recordStatusSchema
})
export type Salesperson = z.infer<typeof salespersonSchema>

/** POST /api/salespeople · PUT /api/salespeople/:id */
export const salespersonInputSchema = z.object(salespersonFields)
export type SalespersonInput = z.infer<typeof salespersonInputSchema>

/**
 * GET /api/salespeople — todos los que cumplen, por código, más «Sin
 * asignar» (`sp-000001`, de sistema: no se edita ni se da de baja).
 */
export const listSalespeopleQuerySchema = z.object({
	query: z.string().trim().max(120).optional(),
	statuses: statusesParam
})
export type ListSalespeopleQuery = z.output<typeof listSalespeopleQuerySchema>

export const listSalespeopleResponseSchema = z.object({
	salespeople: z.array(salespersonSchema)
})

/** GET /api/salespeople/:id · POST · PUT */
export const salespersonResponseSchema = z.object({
	salesperson: salespersonSchema
})

/** GET /api/salespeople/:id/history */
export const salespersonHistoryResponseSchema = z.object({
	history: z.array(historyEventSchema)
})

/**
 * GET /api/salespeople/sales?months=6 — lo facturado (facturas y notas de
 * débito menos notas de crédito) y lo cobrado por mes de cada vendedor
 * activo, del más viejo al más nuevo (el último es el mes en curso), y el
 * mes en curso por rubro (`SalespersonSales` del front). Centavos.
 */
export const salespersonSalesQuerySchema = z.object({
	months: z.coerce.number().int().min(1).max(24).default(6)
})
const salesAmounts = { amount: z.number().int(), collected: z.number().int() }
export const salespersonSalesSchema = z.object({
	salespersonId: recordIdSchema,
	months: z.array(z.object({ period: z.string(), ...salesAmounts })),
	categories: z.array(z.object({ category: z.string(), ...salesAmounts }))
})
export type SalespersonSales = z.infer<typeof salespersonSalesSchema>
export const salespersonSalesResponseSchema = z.object({
	sales: z.array(salespersonSalesSchema)
})
