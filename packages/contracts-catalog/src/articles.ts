import { z } from 'zod'

import { listParam } from '@henko-software/contracts-common'

import {
	airesCodeSchema,
	catalogIdSchema,
	isoDateSchema,
	lookupCodeSchema,
	partIdSchema,
	recordStatusSchema
} from './common.js'

/**
 * Artículos (Aires: Administración › Artículos). Copia
 * `henko-web/apps/web/src/data/articles/schema.ts` y
 * `henko-web/docs/back/articles.md`.
 */

export const ARTICLE_KINDS = [
	'raw_material',
	'finished',
	'resale',
	'supply'
] as const
export const articleKindSchema = z.enum(ARTICLE_KINDS)
export type ArticleKind = z.infer<typeof articleKindSchema>

/** Alícuota de IVA: 21 %, 10,5 %, 27 % y no gravado. */
export const VAT_RATES = [
	'general',
	'reduced',
	'increased',
	'not_taxed'
] as const
export const vatRateSchema = z.enum(VAT_RATES)
export type VatRate = z.infer<typeof vatRateSchema>

/** El porcentaje de cada alícuota. */
export const VAT_PERCENT: Record<VatRate, number> = {
	general: 21,
	reduced: 10.5,
	increased: 27,
	not_taxed: 0
}

export const STOCK_UNITS = [
	'unit',
	'kg',
	'kg_net',
	'box',
	'bag',
	'bottle',
	'dozen',
	'reel'
] as const
export const stockUnitSchema = z.enum(STOCK_UNITS)
export const STOCK_MODES = ['own', 'none', 'derived'] as const
export const STORAGE_TYPES = ['frozen', 'chilled', 'dry'] as const
export const PRODUCTION_TYPES = [
	'frozen',
	'empanadas',
	'portioning',
	'marketing',
	'pizzas',
	'empanada_fillings',
	'empanada_wrappers'
] as const

/** Qué se puede hacer con un artículo (filtro «Uso»). */
export const ARTICLE_USAGES = [
	'purchase',
	'sale',
	'production',
	'recipes'
] as const
export const articleUsageSchema = z.enum(ARTICLE_USAGES)
export type ArticleUsage = z.infer<typeof articleUsageSchema>

export const NUTRIENTS = [
	'energy',
	'calories',
	'carbs',
	'availableCarbs',
	'addedSugars',
	'protein',
	'fat',
	'saturatedFat',
	'monoFat',
	'polyFat',
	'transFat',
	'cholesterol',
	'fiber',
	'sodium'
] as const

/** Alérgenos a declarar (Código Alimentario, art. 235 séptimo). */
export const ALLERGENS = [
	'gluten',
	'crustaceans',
	'eggs',
	'fish',
	'peanuts',
	'soy',
	'milk',
	'treeNuts',
	'sulfites'
] as const

export const COST_SOURCES = ['manual', 'recipe'] as const

const enabledSchema = z.object({
	on: z.boolean(),
	since: isoDateSchema.nullable()
})

export const articleCostSchema = z.object({
	source: z.enum(COST_SOURCES),
	/** Lo que se paga por la unidad de compra, en centavos sin IVA. */
	purchasePrice: z.number().int().min(0).nullable(),
	purchaseQuantity: z.number().positive(),
	purchaseUnit: z.string().trim().max(40).nullable(),
	updatedAt: isoDateSchema.nullable()
})

export const recipeItemSchema = z.object({
	articleId: catalogIdSchema,
	unit: stockUnitSchema,
	quantity: z.number().min(0),
	quantityKg: z.number().min(0),
	percent: z.number().min(0).max(100),
	order: z.number().int().min(0),
	active: z.boolean()
})

export const recipeSchema = z.object({
	wastePct: z.number().min(0).max(100),
	unitWeightKg: z.number().min(0),
	items: z.array(recipeItemSchema).max(200)
})
export type Recipe = z.infer<typeof recipeSchema>

export const presentationSchema = z.object({
	id: partIdSchema,
	/** «Envase»: código de la tabla auxiliar `containers`. */
	container: lookupCodeSchema,
	quantityPerContainer: z.number().min(0),
	freeQuantity: z.boolean(),
	productionReady: z.boolean(),
	isDefault: z.boolean(),
	active: z.boolean(),
	components: z
		.array(
			z.object({ articleId: catalogIdSchema, quantity: z.number().min(0) })
		)
		.max(100)
})
export type Presentation = z.infer<typeof presentationSchema>

export const nutritionRowSchema = z.object({
	nutrient: z.enum(NUTRIENTS),
	per100g: z.number().min(0).nullable(),
	perPortion: z.number().min(0).nullable(),
	dailyValuePct: z.number().min(0).nullable()
})

export const labelSchema = z.object({
	id: partIdSchema,
	model: z.string().max(200),
	language: z.string().max(40),
	description: z.string().max(2000),
	ingredients: z.string().max(4000),
	isDefault: z.boolean(),
	toleranceMinPct: z.number().min(0).max(100),
	toleranceMaxPct: z.number().min(0).max(100),
	active: z.boolean()
})

export const articleGroupMembershipSchema = z.object({
	groupId: catalogIdSchema,
	/** Aires «Prec.»: el agrupamiento le pone precio. */
	prices: z.boolean(),
	/** Aires «Bonif.». */
	discounts: z.boolean()
})

/** Lo editable de un artículo (`ArticleInput` del front). */
export const articleFieldsSchema = z.object({
	description: z.string().trim().min(1).max(120),
	detail: z.string().max(2000).nullable(),
	kind: articleKindSchema,
	/** Categoría de Aires: código de la tabla `article_categories`. */
	category: lookupCodeSchema,
	joinedAt: isoDateSchema.nullable(),
	vatRate: vatRateSchema,
	enabled: z.object({
		purchase: enabledSchema,
		sale: enabledSchema,
		production: enabledSchema,
		recipes: enabledSchema
	}),
	advanceDays: z.number().int().min(0),
	defaultWarehouse: z.string().max(60),
	accountingCategory: z.object({
		purchase: z.string().max(120),
		sale: z.string().max(120)
	}),
	requiresAnalysisProtocol: z.boolean(),
	yieldPct: z.number().min(0).max(1000),
	expeditionSheetCategory: z.string().max(120).nullable(),
	productionSheetCategory: z.string().max(120).nullable(),
	barcodes: z.object({
		dun14: z.string().max(14).nullable(),
		ean13: z.string().max(13).nullable(),
		quantityPerEan13: z.number().min(0)
	}),
	rnpa: z.string().max(30).nullable(),
	groups: z.array(articleGroupMembershipSchema).max(100),
	presentations: z.array(presentationSchema).max(50),
	stock: z.object({
		mode: z.enum(STOCK_MODES),
		storage: z.enum(STORAGE_TYPES),
		lotControl: z.boolean(),
		unit: stockUnitSchema,
		min: z.number().min(0),
		max: z.number().min(0),
		showShortage: z.boolean()
	}),
	recipe: recipeSchema.nullable(),
	expeditionRecipe: recipeSchema.nullable(),
	nutrition: z
		.object({
			portion: z.string().max(80),
			portionsPerContainer: z.string().max(80),
			rows: z.array(nutritionRowSchema).max(NUTRIENTS.length),
			added: z.object({
				sugars: z.boolean(),
				fats: z.boolean(),
				sodium: z.boolean()
			})
		})
		.nullable(),
	production: z
		.object({
			type: z.enum(PRODUCTION_TYPES),
			shelfLifeDays: z.number().int().min(0),
			hasGluten: z.boolean(),
			celiacFriendly: z.boolean(),
			transFat: z.boolean(),
			kosher: z.boolean(),
			kosherDairy: z.boolean(),
			labels: z.array(labelSchema).max(50),
			batchQuantity: z.number().min(0),
			hoursRequired: z.number().min(0),
			staffRequired: z.number().min(0)
		})
		.nullable(),
	cost: articleCostSchema,
	allergens: z.array(z.enum(ALLERGENS)),
	notes: z.string().max(2000).nullable(),
	/**
	 * URL de la foto. Hoy el front manda un `data:` URL achicado; la carga
	 * como archivo es una decisión pendiente (`docs/back/articles.md`).
	 */
	photoUrl: z.string().url().max(300_000).nullable()
})
export type ArticleFields = z.infer<typeof articleFieldsSchema>

export const articleSchema = z.object({
	id: catalogIdSchema,
	/** Seis dígitos, el siguiente al más alto. Lo pone el sistema. */
	code: airesCodeSchema,
	status: recordStatusSchema,
	...articleFieldsSchema.shape,
	version: z.number().int().min(1),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime()
})
export type Article = z.infer<typeof articleSchema>

/** GET /internal/articles. Orden: descripción (es). */
export const listArticlesQuerySchema = z.object({
	/** Sin tildes, sobre código, descripción y EAN-13. */
	query: z.string().trim().max(120).optional(),
	statuses: listParam(recordStatusSchema),
	kinds: listParam(articleKindSchema),
	categories: listParam(lookupCodeSchema),
	/** Y: tiene que cumplir todos los usos. */
	usage: listParam(articleUsageSchema),
	groupIds: listParam(catalogIdSchema)
})
export type ListArticlesQuery = z.output<typeof listArticlesQuerySchema>

export const listArticlesResponseSchema = z.object({
	articles: z.array(articleSchema)
})

/** POST /internal/articles. Con `id` repetido no se duplica: devuelve el que hay. */
export const createArticleRequestSchema = articleFieldsSchema.extend({
	id: catalogIdSchema.optional()
})
export type CreateArticleRequest = z.input<typeof createArticleRequestSchema>

/** PUT /internal/articles/:id — objeto entero. */
export const updateArticleRequestSchema = articleFieldsSchema.extend({
	expectedVersion: z.number().int().min(1).optional()
})
export type UpdateArticleRequest = z.input<typeof updateArticleRequestSchema>

/** GET /internal/articles/:id · POST · PUT · POST /:id/duplicate */
export const articleResponseSchema = z.object({ article: articleSchema })

/** GET /internal/articles/:id/used-in: en qué recetas está (todos los estados). */
export const articleUsedInResponseSchema = listArticlesResponseSchema

/**
 * Lo que viaja en los eventos `catalog.article.*.v1` (stream `CATALOG`). El
 * que necesita más datos, pide el artículo.
 */
export const articleSummarySchema = z.object({
	id: catalogIdSchema,
	code: airesCodeSchema,
	description: z.string(),
	kind: articleKindSchema,
	category: lookupCodeSchema,
	vatRate: vatRateSchema,
	status: recordStatusSchema,
	saleEnabled: z.boolean(),
	presentationIds: z.array(partIdSchema),
	groupIds: z.array(catalogIdSchema),
	version: z.number().int()
})
export const articleEventSchema = z.object({ article: articleSummarySchema })
export const ARTICLE_EVENT_TYPES = [
	'catalog.article.created.v1',
	'catalog.article.updated.v1',
	'catalog.article.archived.v1',
	'catalog.article.restored.v1'
] as const
export type ArticleEventType = (typeof ARTICLE_EVENT_TYPES)[number]
