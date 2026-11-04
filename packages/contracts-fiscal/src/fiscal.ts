import { z } from 'zod'

import {
	cuitDigitsSchema,
	docTypeSchema,
	provinceSchema,
	vatConditionSchema,
	vatRateSchema,
	voucherKindSchema,
	voucherLetterSchema
} from './codes.js'

/**
 * Contrato interno de `fiscal`: autoriza comprobantes ante ARCA (CAE y, si
 * ARCA no responde o la caja está sin internet, CAEA), lleva la numeración
 * por punto de venta y tipo, y consulta el padrón. Lo llaman el orquestador
 * (facturar, devolver) y el BFF (padrón) con un token interno firmado. Las
 * rutas van bajo `/internal`.
 *
 * Plata en centavos enteros; fechas de comprobante `YYYY-MM-DD` (hora de
 * Argentina); instantes ISO en UTC; ids UUIDv7 generados por quien llama.
 */

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const centsSchema = z.number().int().min(0)

/** Punto de venta de ARCA: 1 a 99998. */
export const pointOfSaleNumberSchema = z.number().int().min(1).max(99998)

// ---------- Comprobante que se pide autorizar

/**
 * Una línea, con los mismos campos de precio que `InvoiceLine` del front:
 * el módulo calcula los importes con la misma regla (`invoiceTotals`).
 */
export const voucherLineSchema = z.object({
	/** Presentaciones facturadas. */
	quantity: z.number().positive(),
	/** Unidades de stock por presentación. */
	perUnit: z.number().positive(),
	/** Sin IVA, por unidad de stock, en centavos (puede traer fracción de centavo). */
	unitNetPrice: z.number().min(0),
	discountPct: z.number().min(0).max(100),
	vatRate: vatRateSchema
})
export type VoucherLine = z.infer<typeof voucherLineSchema>

export const receiverSchema = z.object({
	/** Como estaba al facturar. ARCA la exige (RG 5616). */
	vatCondition: vatConditionSchema,
	/** `null` = consumidor final sin identificar (sólo B). */
	docType: docTypeSchema.nullable(),
	/** Sólo dígitos. */
	docNumber: z.string().regex(/^\d{0,20}$/)
})
export type Receiver = z.infer<typeof receiverSchema>

/** Comprobante asociado de una nota de crédito o débito (RG 4540). */
export const relatedVoucherSchema = z.object({
	kind: voucherKindSchema,
	letter: voucherLetterSchema,
	pointOfSale: pointOfSaleNumberSchema,
	number: z.number().int().min(1).max(99999999),
	date: isoDateSchema
})
export type RelatedVoucher = z.infer<typeof relatedVoucherSchema>

export const CONCEPTS = [
	'products',
	'services',
	'products_and_services'
] as const

export const voucherInputSchema = z.object({
	/**
	 * Id del comprobante (UUIDv7) que genera quien llama. Es la clave de
	 * idempotencia: el mismo id dos veces es el mismo comprobante.
	 */
	id: z.uuid(),
	localId: z.string().min(1),
	/** Punto de venta principal (CAE). En contingencia el módulo usa el de CAEA asociado. */
	pointOfSale: pointOfSaleNumberSchema,
	kind: voucherKindSchema,
	letter: voucherLetterSchema,
	date: isoDateSchema,
	concept: z.enum(CONCEPTS).default('products'),
	/** Obligatorio si hay servicios. */
	service: z
		.object({
			from: isoDateSchema,
			to: isoDateSchema,
			paymentDue: isoDateSchema
		})
		.nullable()
		.default(null),
	receiver: receiverSchema,
	lines: z.array(voucherLineSchema).min(1).max(500),
	/** Bonificación general del comprobante. */
	bonusPct: z.number().min(0).max(100).default(0),
	/** Obligatorio en notas de crédito y débito. */
	related: relatedVoucherSchema.nullable().default(null),
	/** De dónde sale (factura, devolución…), para trazar. No va a ARCA. */
	sourceRef: z.string().max(120).nullable().default(null)
})
export type VoucherInput = z.input<typeof voucherInputSchema>

/** POST /internal/vouchers — autorizar con CAE (o CAEA si ARCA no responde). */
export const authorizeVoucherRequestSchema = voucherInputSchema.extend({
	/** Si ARCA no responde, ¿se puede emitir con CAEA? Por defecto sí (RG 5785: primera opción de contingencia). */
	allowContingency: z.boolean().default(true)
})
export type AuthorizeVoucherRequest = z.input<
	typeof authorizeVoucherRequestSchema
>

// ---------- Comprobante que devuelve

export const voucherTotalsSchema = z.object({
	/** Neto gravado: suma de las bases por alícuota, cada una redondeada al centavo. */
	net: centsSchema,
	/** No gravado (`not_taxed`): `ImpTotConc`. */
	notTaxed: centsSchema,
	exempt: centsSchema,
	vat: centsSchema,
	/** Otros tributos (percepciones). Hoy siempre 0: ver pendientes del README. */
	tributes: centsSchema,
	total: centsSchema,
	vatBreakdown: z.array(
		z.object({
			rate: vatRateSchema,
			base: centsSchema,
			amount: centsSchema
		})
	)
})
export type VoucherTotals = z.infer<typeof voucherTotalsSchema>

export const authorizationSchema = z.object({
	type: z.enum(['CAE', 'CAEA']),
	code: z.string().regex(/^\d{14}$/),
	/** Vencimiento del CAE, o fin de la quincena del CAEA. */
	dueDate: isoDateSchema
})

export const arcaMessageSchema = z.object({
	code: z.number().int(),
	message: z.string()
})
export type ArcaMessage = z.infer<typeof arcaMessageSchema>

/**
 * - `authorized`: con CAE.
 * - `contingency`: emitido con CAEA; falta o ya se informó a ARCA (`reportedAt`).
 * - `pending`: ARCA no contestó y no se sabe si lo autorizó; el módulo lo
 *   reconcilia solo (consulta el último autorizado) y avisa con un evento.
 * - `rejected`: ARCA lo rechazó (ver `errors`). El número no se consumió.
 */
export const VOUCHER_STATUSES = [
	'authorized',
	'contingency',
	'pending',
	'rejected'
] as const

export const voucherSchema = z.object({
	id: z.uuid(),
	localId: z.string(),
	status: z.enum(VOUCHER_STATUSES),
	kind: voucherKindSchema,
	letter: voucherLetterSchema,
	/** `CbteTipo` de ARCA. */
	voucherType: z.number().int(),
	/** El punto de venta con el que salió (el de CAEA en contingencia). */
	pointOfSale: pointOfSaleNumberSchema,
	/** `null` mientras no tiene número. */
	number: z.number().int().nullable(),
	/** `00002-00000123`: 5 dígitos de punto de venta y 8 de número. */
	formattedNumber: z.string().nullable(),
	date: isoDateSchema,
	totals: voucherTotalsSchema,
	authorization: authorizationSchema.nullable(),
	/** Leyendas que el papel tiene que llevar (`monotributo`: Ley 27.618 / RG 5003). */
	legends: z.array(z.enum(['monotributo'])),
	/** Observaciones de ARCA (aprobado con observaciones). */
	observations: z.array(arcaMessageSchema),
	/** Por qué ARCA lo rechazó. */
	errors: z.array(arcaMessageSchema),
	/** QR de la RG 4291, listo para el papel. `null` sin autorización. */
	qrUrl: z.string().nullable(),
	/** Comprobante con CAEA: cuándo se informó a ARCA. */
	reportedAt: z.iso.datetime().nullable(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime()
})
export type Voucher = z.infer<typeof voucherSchema>

export const voucherResponseSchema = z.object({ voucher: voucherSchema })
export type VoucherResponse = z.infer<typeof voucherResponseSchema>

/** GET /internal/vouchers/:id — `common.not_found` si no existe. */

// ---------- Último autorizado

/** GET /internal/points-of-sale/:pointOfSale/types/:voucherType/last — pregunta a ARCA. */
export const lastAuthorizedResponseSchema = z.object({
	pointOfSale: pointOfSaleNumberSchema,
	voucherType: z.number().int(),
	/** 0 si nunca se autorizó ninguno. */
	number: z.number().int().min(0)
})
export type LastAuthorizedResponse = z.infer<
	typeof lastAuthorizedResponseSchema
>

// ---------- Puntos de venta

/**
 * Un punto de venta dado de alta en ARCA. Los de CAEA son propios (RG 5782,
 * art. 5) y cada uno respalda a uno de CAE (`contingencyFor`). Para emitir
 * sin internet, cada caja tiene su propio punto de venta CAEA (`deviceId`):
 * así dos cajas sin conexión nunca usan el mismo número.
 */
export const pointOfSaleSchema = z.object({
	number: pointOfSaleNumberSchema,
	mode: z.enum(['cae', 'caea']),
	localId: z.string().min(1).nullable(),
	contingencyFor: pointOfSaleNumberSchema.nullable(),
	deviceId: z.uuid().nullable(),
	active: z.boolean()
})
export type PointOfSale = z.infer<typeof pointOfSaleSchema>

/** GET /internal/points-of-sale */
export const listPointsOfSaleResponseSchema = z.object({
	pointsOfSale: z.array(pointOfSaleSchema)
})

/** PUT /internal/points-of-sale/:number — alta o cambio (sólo superadmin y casa central). */
export const upsertPointOfSaleRequestSchema = pointOfSaleSchema.omit({
	number: true
})

// ---------- CAEA

export const caeaPeriodSchema = z.string().regex(/^\d{4}(0[1-9]|1[0-2])$/)
export const caeaOrderSchema = z.union([z.literal(1), z.literal(2)])

export const caeaSchema = z.object({
	code: z.string().regex(/^\d{14}$/),
	/** `YYYYMM`. */
	period: caeaPeriodSchema,
	/** 1 = del 1 al 15; 2 = del 16 a fin de mes (RG 5782, art. 4). */
	order: caeaOrderSchema,
	validFrom: isoDateSchema,
	validTo: isoDateSchema,
	/** Hasta cuándo se informan los comprobantes (8 días corridos después del fin, art. 6). */
	reportDeadline: isoDateSchema,
	/** Ya se informó todo a ARCA. */
	reportedAt: z.iso.datetime().nullable()
})
export type Caea = z.infer<typeof caeaSchema>

/**
 * POST /internal/caea — pide (o recupera, si ya estaba otorgado) el CAEA de
 * una quincena. Se puede desde 5 días corridos antes de que empiece.
 */
export const requestCaeaRequestSchema = z.object({
	period: caeaPeriodSchema,
	order: caeaOrderSchema
})
export const caeaResponseSchema = z.object({ caea: caeaSchema })

/** GET /internal/caea/current?date=YYYY-MM-DD — el de esa fecha (hoy si no viene), `null` si no hay. Lo bajan las cajas. */
export const currentCaeaResponseSchema = z.object({
	caea: caeaSchema.nullable()
})

/**
 * POST /internal/caea/vouchers — un comprobante que una caja emitió sin
 * internet con CAEA, con el número de su punto de venta CAEA. Idempotente
 * por `id`.
 */
export const registerCaeaVoucherRequestSchema = voucherInputSchema.extend({
	number: z.number().int().min(1).max(99999999),
	caea: z.string().regex(/^\d{14}$/),
	/** Fecha y hora en que la caja lo generó (`CbteFchHsGen`, obligatorio desde la RG 5782). */
	generatedAt: z.iso.datetime()
})
export type RegisterCaeaVoucherRequest = z.input<
	typeof registerCaeaVoucherRequestSchema
>

/** POST /internal/caea/report — informa a ARCA lo emitido con CAEA en una quincena y los puntos de venta sin movimiento. */
export const reportCaeaRequestSchema = requestCaeaRequestSchema
export const reportCaeaResponseSchema = z.object({
	reported: z.number().int().min(0),
	rejected: z.array(
		z.object({ voucherId: z.uuid(), errors: z.array(arcaMessageSchema) })
	),
	noMovement: z.array(pointOfSaleNumberSchema),
	/** Huecos de numeración encontrados en los puntos de venta CAEA (no se informan hasta resolverlos). */
	gaps: z.array(
		z.object({
			pointOfSale: pointOfSaleNumberSchema,
			voucherType: z.number().int(),
			missing: z.array(z.number().int())
		})
	)
})
export type ReportCaeaResponse = z.infer<typeof reportCaeaResponseSchema>

// ---------- Padrón

/** Igual que `TaxRegistryEntry` del front, salvo `invoiceKind` y `apoc`, que pueden no saberse. */
export const taxpayerSchema = z.object({
	cuit: z.string().regex(/^\d{11}$/),
	personType: z.enum(['company', 'person']),
	legalName: z.string().min(1),
	vatCondition: vatConditionSchema,
	activity: z.string(),
	address: z.string(),
	city: z.string(),
	province: provinceSchema.nullable(),
	postalCode: z.string(),
	active: z.boolean(),
	/** RG 5762. `null`: la constancia no lo dice; falta la consulta específica. */
	invoiceKind: z.enum(['standard', 'withholding', 'cbu']).nullable(),
	/** Base APOC. `null`: no se consultó (otro servicio de ARCA). */
	apoc: z.boolean().nullable()
})
export type Taxpayer = z.infer<typeof taxpayerSchema>

/** GET /internal/taxpayers/:cuit — `taxpayer: null` si no figura en el padrón. */
export const taxpayerCuitParamSchema = cuitDigitsSchema
export const lookupTaxpayerResponseSchema = z.object({
	taxpayer: taxpayerSchema.nullable(),
	source: z.enum(['arca', 'cache']),
	fetchedAt: z.iso.datetime()
})
export type LookupTaxpayerResponse = z.infer<
	typeof lookupTaxpayerResponseSchema
>

// ---------- Errores

/** Claves de error propias de fiscal (además de las `common.*`). */
export const FISCAL_ERRORS = [
	/** ARCA rechazó el comprobante; `details.errors` y `details.observations` traen lo que dijo. */
	'fiscal.rejected',
	/** ARCA no responde y no se pudo (o no se permitió) emitir con CAEA. */
	'fiscal.unavailable',
	/** El certificado, la CUIT o la relación con el servicio no están bien configurados. */
	'fiscal.credentials',
	/** Falta la condición frente al IVA del receptor o ARCA no la acepta (RG 5616). */
	'fiscal.receiver_vat_condition',
	/** La letra no corresponde a la condición del receptor. */
	'fiscal.letter_mismatch',
	/** CUIT o documento del receptor inválido para ese comprobante. */
	'fiscal.invalid_receiver',
	/** La fecha está fuera de lo que ARCA acepta (N−5 a N+5 en productos). */
	'fiscal.date_out_of_range',
	/** Nota sin comprobante asociado, letra E, importes que no cierran… */
	'fiscal.invalid_voucher',
	/** El mismo id ya se usó con otros datos. */
	'fiscal.idempotency_conflict',
	/** El punto de venta no está dado de alta en Henko (o no tiene CAEA de contingencia). */
	'fiscal.point_of_sale',
	/** No hay CAEA para esa quincena o el informado no es el de la fecha. */
	'fiscal.caea_unavailable',
	/** Ya hay otro comprobante con ese número en ese punto de venta y tipo. */
	'fiscal.number_taken'
] as const
export type FiscalErrorKey = (typeof FISCAL_ERRORS)[number]

// ---------- Eventos

/** `fiscal.voucher.authorized.v1` — con CAE. */
export const voucherAuthorizedEventSchema = z.object({ voucher: voucherSchema })
/** `fiscal.voucher.contingency.v1` — salió con CAEA (falta informarlo). */
export const voucherContingencyEventSchema = z.object({
	voucher: voucherSchema
})
/** `fiscal.voucher.rejected.v1` */
export const voucherRejectedEventSchema = z.object({ voucher: voucherSchema })
/** `fiscal.caea.reported.v1` — la quincena quedó informada. */
export const caeaReportedEventSchema = z.object({
	caea: caeaSchema,
	reported: z.number().int(),
	noMovement: z.array(pointOfSaleNumberSchema)
})
