import { z } from 'zod'

import {
	invoiceKindSchema,
	provinceSchema,
	supplierFiscalCheckSchema,
	vatConditionSchema
} from '@henko-software/contracts-contacts'

/**
 * Padrón de ARCA (constancia de inscripción), como lo usa el front
 * (`henko-web/apps/web/src/data/tax_registry/schema.ts`). Lo consulta el BFF
 * en `fiscal` con el rol efectivo de quien pide: cualquier persona que opere
 * (superadmin, casa central, franquiciado, encargado, cajero).
 */

/** Los 11 dígitos de un CUIT. */
export const cuitDigitsParamSchema = z.string().regex(/^\d{11}$/)

export const taxRegistryEntrySchema = z.object({
	cuit: z.string().regex(/^\d{11}$/),
	personType: z.enum(['company', 'person']),
	legalName: z.string().min(1),
	vatCondition: vatConditionSchema,
	activity: z.string(),
	address: z.string(),
	city: z.string(),
	/** `null`: ARCA no la informa (o vino un código que no se conoce). */
	province: provinceSchema.nullable(),
	postalCode: z.string(),
	/** `false` si el CUIT está dado de baja en ARCA. */
	active: z.boolean(),
	/**
	 * Qué factura A le corresponde (RG 5762). `null` = no se sabe (fiscal
	 * todavía no tiene esa consulta). Decisión asumida 20: no bloquea, avisa.
	 */
	invoiceKind: invoiceKindSchema.nullable(),
	/**
	 * Si figura en la base APOC. `null` = no se sabe (fiscal todavía no tiene
	 * esa consulta). Decisión asumida 20: no bloquea, avisa.
	 */
	apoc: z.boolean().nullable()
})
export type TaxRegistryEntry = z.infer<typeof taxRegistryEntrySchema>

/**
 * GET /api/tax-registry/:cuit — lo que dice el padrón de ese CUIT;
 * `entry: null` si no figura. `fetchedAt` es cuándo se le preguntó a ARCA
 * (fiscal lo guarda un día). Un CUIT mal formado es 422 `common.validation`;
 * ARCA caído y sin nada guardado, el error de fiscal (`fiscal.unavailable`).
 */
export const taxRegistryLookupResponseSchema = z.object({
	entry: taxRegistryEntrySchema.nullable(),
	fetchedAt: z.iso.datetime()
})
export type TaxRegistryLookupResponse = z.infer<
	typeof taxRegistryLookupResponseSchema
>

/**
 * POST /api/suppliers/:id/fiscal-check — consulta el CUIT del proveedor en el
 * padrón y guarda la «Situación en ARCA» (queda en el historial). Responde
 * lo guardado. El alta y la edición de un proveedor con CUIT nuevo la
 * guardan solas.
 *
 * - Documento que no es un CUIT de 11 dígitos: 422 `bff.fiscal_check_not_cuit`
 *   (el front lo muestra como `H-PV002`).
 * - CUIT que no figura en el padrón: 422 `bff.taxpayer_not_found`.
 */
export const fiscalCheckResponseSchema = z.object({
	fiscalCheck: supplierFiscalCheckSchema
})
export type FiscalCheckResponse = z.infer<typeof fiscalCheckResponseSchema>
