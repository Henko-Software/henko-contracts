import { z } from 'zod'

import { centsSchema, isoDateSchema, refIdSchema } from './common.js'

/**
 * Aperturas: evaluar una esquina para un local nuevo. Copia
 * `henko-web/apps/web/src/data/openings/schema.ts`. network junta el entorno
 * (gente, competencia, qué hay alrededor, los Big Pizza cerca) por sus
 * puertos y arma la ficha con las mismas reglas que `rules.ts` del front.
 */

export const pointSchema = z.object({
	lat: z.number().min(-90).max(90),
	lon: z.number().min(-180).max(180)
})
export type Point = z.infer<typeof pointSchema>

/** Una dirección que se puede evaluar (lo que devuelve el buscador). */
export const addressSchema = z.object({
	/** Lo pone network: `<proveedor>:<id>` (`georef:0201…`, `fake:…`). */
	id: z.string().trim().min(1).max(120),
	/** «Av. Cabildo 1900». */
	street: z.string(),
	/** Barrio o localidad: «Belgrano», «Rosario». */
	area: z.string(),
	city: z.string(),
	point: pointSchema
})
export type Address = z.infer<typeof addressSchema>

export const POI_KINDS = [
	'transit',
	'school',
	'health',
	'sports',
	'food',
	'shops',
	'competitor',
	'anchor',
	'landmark'
] as const
export const poiKindSchema = z.enum(POI_KINDS)
export type PoiKind = z.infer<typeof poiKindSchema>

export const POI_SUBTYPES = [
	'bus',
	'subway',
	'train',
	'primary',
	'secondary',
	'university',
	'hospital',
	'clinic',
	'club',
	'gym',
	'restaurant',
	'bar',
	'shop',
	'office',
	'pizzeria',
	'burger',
	'empanadas',
	'supermarket',
	'pharmacy',
	'mall',
	'square'
] as const
export const poiSubtypeSchema = z.enum(POI_SUBTYPES)
export type PoiSubtype = z.infer<typeof poiSubtypeSchema>

export const poiSchema = z.object({
	id: z.string(),
	kind: poiKindSchema,
	subtype: poiSubtypeSchema,
	/** Metros desde el punto. */
	distance: z.number().min(0),
	/** Hacia dónde, en grados desde el norte (90 = este). */
	bearing: z.number().min(0).max(360)
})
export type Poi = z.infer<typeof poiSchema>

/** Un Big Pizza de la red cerca del punto (es un cliente franquiciado). */
export const nearbyStoreSchema = z.object({
	customerId: z.string(),
	name: z.string(),
	address: z.string(),
	distance: z.number().min(0),
	bearing: z.number().min(0).max(360)
})
export type NearbyStore = z.infer<typeof nearbyStoreSchema>

export const POPULATION_SOURCES = ['census', 'buildings'] as const
export const populationSourceSchema = z.enum(POPULATION_SOURCES)
export type PopulationSource = z.infer<typeof populationSourceSchema>

export const zoneRentSchema = z.object({
	monthly: z.number().int().positive(),
	asOf: isoDateSchema,
	samples: z.number().int().positive()
})

/** El entorno de un punto. No dice si el lugar sirve: eso lo dicen las reglas. */
export const surroundingsSchema = z.object({
	address: addressSchema,
	/** Gente que vive a menos de 8 cuadras. */
	population: z.number().int().min(0),
	populationSource: populationSourceSchema,
	pois: z.array(poiSchema),
	stores: z.array(nearbyStoreSchema),
	/** El mapa no respondió: falta parte de lo que hay alrededor. */
	incomplete: z.boolean(),
	/** Alquiler típico de la zona (centavos por mes), si hay datos. */
	rent: zoneRentSchema.nullable()
})
export type Surroundings = z.infer<typeof surroundingsSchema>

/** Lo que factura por mes un local de la red (venta al público, centavos). */
export const storeSalesSchema = z.object({
	customerId: z.string(),
	name: z.string(),
	point: pointSchema,
	monthly: z.number().int().min(0),
	/** Meses abierto: los primeros seis no cuentan para la franja. */
	months: z.number().int().min(0)
})
export type StoreSales = z.infer<typeof storeSalesSchema>

export const FACTOR_KEYS = [
	'population',
	'transit',
	'schools',
	'health',
	'sports',
	'buzz',
	'shops',
	'competition',
	'overlap'
] as const
export const factorKeySchema = z.enum(FACTOR_KEYS)
export type FactorKey = z.infer<typeof factorKeySchema>

export const factorSchema = z.object({
	key: factorKeySchema,
	/** Lo que suma (o resta, si es negativo). */
	points: z.number(),
	/** Lo más que puede sumar o restar. */
	cap: z.number(),
	count: z.number().int().min(0),
	nearest: z.number().min(0).nullable()
})
export type Factor = z.infer<typeof factorSchema>

/** La escala del veredicto, de mejor a peor. `missing`: faltan datos. */
export const VERDICTS = [
	'great',
	'good',
	'weak',
	'poor',
	'no',
	'missing'
] as const
export const verdictSchema = z.enum(VERDICTS)
export type Verdict = z.infer<typeof verdictSchema>

export const OVERLAP_LEVELS = ['critical', 'warning', 'clear'] as const
export type OverlapLevel = (typeof OVERLAP_LEVELS)[number]

export const BAND_SCOPES = ['amba', 'interior', 'network'] as const
export type BandScope = (typeof BAND_SCOPES)[number]

/** De dónde salió la venta de los locales que arman la franja. */
export const BAND_SOURCES = ['sales', 'estimate', 'mixed'] as const
export type BandSource = (typeof BAND_SOURCES)[number]

export const salesBandSchema = z.object({
	from: centsSchema,
	to: centsSchema,
	median: centsSchema,
	low: centsSchema,
	high: centsSchema,
	scope: z.enum(BAND_SCOPES),
	stores: z.number().int().min(0),
	examples: z.array(storeSalesSchema)
})
export type SalesBand = z.infer<typeof salesBandSchema>

export const RENT_LEVELS = ['comfortable', 'tight', 'heavy'] as const
export type RentLevel = (typeof RENT_LEVELS)[number]

export const TO_CHECK = [
	'rent',
	'oldRent',
	'population',
	'competitors',
	'overlap',
	'surroundings'
] as const

export const adviceSchema = z.object({
	pros: z.array(factorKeySchema),
	cons: z.array(factorKeySchema),
	toCheck: z.array(z.enum(TO_CHECK))
})
export type Advice = z.infer<typeof adviceSchema>

/** La ficha de un punto: lo que se ve en pantalla. */
export const evaluationSchema = surroundingsSchema.extend({
	factors: z.array(factorSchema),
	score: z.number().int().min(0).max(100),
	verdict: verdictSchema,
	overlap: z.object({
		level: z.enum(OVERLAP_LEVELS),
		store: nearbyStoreSchema.nullable()
	}),
	confidence: z.enum(['high', 'medium', 'low']),
	populationRank: z.number().int().min(0).max(100),
	band: salesBandSchema.nullable(),
	rentShare: z
		.object({ pct: z.number(), level: z.enum(RENT_LEVELS) })
		.nullable(),
	advice: adviceSchema,
	evaluatedAt: z.iso.datetime()
})
export type Evaluation = z.infer<typeof evaluationSchema>

/** GET /internal/addresses?q= : sin texto, las últimas evaluadas. */
export const searchAddressesQuerySchema = z.object({
	q: z.string().trim().max(120).optional()
})
export const searchAddressesResponseSchema = z.object({
	addresses: z.array(addressSchema)
})

/**
 * Lo que un local le compró a la central por mes (de sales), para cuando
 * no hay venta al público cargada. Lo trae quien llama (el BFF).
 */
export const customerSalesSchema = z.object({
	customerId: refIdSchema,
	/** Promedio mensual de los meses con venta, en centavos. */
	monthly: z.number().int().min(0),
	/** Cuántos meses con venta tiene. */
	months: z.number().int().min(0)
})
export type CustomerSales = z.infer<typeof customerSalesSchema>

/**
 * POST /internal/evaluations. La ficha de una dirección ya buscada. `sales`
 * es opcional: sin eso (o para los locales que no aparecen), la venta sale
 * del adaptador configurado. `fresh` salta la caché.
 */
export const evaluateRequestSchema = z.object({
	addressId: addressSchema.shape.id,
	sales: z.array(customerSalesSchema).max(5_000).optional(),
	fresh: z.boolean().optional()
})
export type EvaluateRequest = z.input<typeof evaluateRequestSchema>

export const evaluationResponseSchema = z.object({
	evaluation: evaluationSchema,
	/** De dónde salió la venta de la franja. */
	bandSource: z.enum(BAND_SOURCES).nullable()
})
