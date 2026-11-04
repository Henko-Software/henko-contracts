import { z } from 'zod'

import {
	accountCodeSchema,
	airesCodeSchema,
	cbuSchema,
	countryCodeSchema,
	docTypeSchema,
	geoPointSchema,
	isoDateSchema,
	lookupCodeSchema,
	provinceSchema,
	recordStatusSchema,
	refineDocNumber,
	vatConditionSchema
} from './argentina.js'
import { booleanParam, listParam } from './params.js'

/**
 * Contrato interno de `contacts`: contactos como en Odoo. Una sola entidad
 * para personas y empresas (`Contact`), con roles que se suman (cliente,
 * proveedor, transportista, vendedor…). El mismo CUIT no se duplica para ser
 * cliente y proveedor: es un contacto con dos roles. Lo propio de cada rol
 * (lo comercial de un cliente, la CBU de un proveedor, los vehículos de un
 * transportista) va en el `profile` de ese rol.
 *
 * Lo llama el BFF (y después el orquestador) con un token interno firmado,
 * bajo `/internal`. El BFF arma cada vista de Administración (Clientes,
 * Proveedores…) a partir de esto.
 *
 * Ids UUIDv7, fechas de día `YYYY-MM-DD`, momentos ISO en UTC, plata en
 * centavos. Campos siempre presentes: lo que no hay viene en `null`.
 */

// ---------- Roles

export const CONTACT_ROLES = [
	'customer',
	'supplier',
	'carrier',
	'salesperson',
	'employee',
	'franchise'
] as const
export const contactRoleSchema = z.enum(CONTACT_ROLES)
export type ContactRole = z.infer<typeof contactRoleSchema>

/** Persona humana o empresa. En transportistas: chofer (`person`) o empresa. */
export const contactKindSchema = z.enum(['person', 'company'])
export type ContactKind = z.infer<typeof contactKindSchema>

// ---------- Datos de contacto (comunes)

/**
 * Teléfonos, mails y domicilio. Es la unión de lo que tienen clientes,
 * proveedores, transportistas y vendedores en Aires; en transportistas y
 * vendedores el front lo usa plano en la raíz (lo aplana el BFF).
 */
export const contactInfoSchema = z.object({
	phone1: z.string().max(40).nullable(),
	phone2: z.string().max(40).nullable(),
	/** Aires todavía lo pide; casi nadie lo usa. */
	fax: z.string().max(40).nullable(),
	email: z.email().nullable(),
	website: z.string().max(120).nullable(),
	address: z.string().max(120).nullable(),
	/** «Nro.» del domicilio (proveedores lo tienen aparte). */
	streetNumber: z.string().max(10).nullable(),
	floor: z.string().max(10).nullable(),
	city: z.string().max(80).nullable(),
	province: provinceSchema.nullable(),
	postalCode: z.string().max(10).nullable(),
	/** ISO de dos letras. Fuera de la Argentina, `province` va en null y la provincia o estado en `region`. */
	country: countryCodeSchema,
	region: z.string().max(80).nullable()
})
export type ContactInfo = z.infer<typeof contactInfoSchema>

// ---------- Cliente

export const IIBB_CONDITIONS = [
	'local',
	'multilateral',
	'exempt',
	'not_registered'
] as const
export const iibbConditionSchema = z.enum(IIBB_CONDITIONS)

/** Lugar de entrega (Aires: pestaña «L. de Entrega»). */
export const deliveryPlaceSchema = z.object({
	id: z.string().min(1).max(40),
	active: z.boolean(),
	address: z.string().max(120),
	city: z.string().max(80),
	province: provinceSchema.nullable(),
	region: z.string().max(80).nullable(),
	/** Zona de reparto («CABA Norte»). */
	zone: z.string().max(60).nullable()
})

/** Lo que se carga de un cliente (Aires: Administración › Clientes). */
export const customerProfileInputSchema = z.object({
	/** «Cód. planilla expedición». */
	expeditionSheetCode: z.string().max(10).nullable(),
	/** «Tipo de Cliente»: código de la tabla `customer_types`. */
	customerType: lookupCodeSchema,
	/** «Canal de Vta.»: código de la tabla `sales_channels`. */
	salesChannel: lookupCodeSchema,
	/** «Fecha Ingreso». */
	joinedAt: isoDateSchema,
	/** «E-mail Facturación». */
	billingEmail: z.email().nullable(),
	/** Sólo si tiene acceso al portal; la clave de Aires no se migra. */
	portalAccess: z.boolean(),
	/** Transportista (contacto con rol `carrier`). `null` = sin asignar. */
	carrierId: z.uuid().nullable(),
	commercial: z.object({
		commercialPriority: z.number().int().min(0).max(9),
		iibbCondition: iibbConditionSchema,
		iibbStatus: z.string().max(60).nullable(),
		iibbNumber: z.string().max(20).nullable(),
		/** Condición de pago con alcance `customers`. */
		paymentTermId: z.uuid(),
		/** Vendedor (contacto con rol `salesperson`). `null` = sin asignar. */
		salespersonId: z.uuid().nullable(),
		/** Crédito máximo en centavos (ARS). 0 = sin límite cargado. */
		creditLimit: z.number().int().min(0),
		financialBlock: z.boolean(),
		invoiceByDeliveryPlace: z.boolean(),
		updateAccountStatus: z.boolean(),
		checkLastSaleDays: z.number().int().min(0).max(365).nullable(),
		sendStatementByEmail: z.boolean(),
		marginPct: z.number().min(0).max(100),
		/** Ids del módulo de precios: acá no se validan. */
		priceListId: z.string().min(1).max(60),
		basePriceListId: z.string().min(1).max(60).nullable(),
		discountListId: z.string().min(1).max(60).nullable(),
		insurancePct: z.number().min(0).max(100),
		discountPct: z.number().min(0).max(100),
		bonusPct: z.number().min(0).max(100)
	}),
	deliveryPlaces: z.array(deliveryPlaceSchema).max(200),
	groupIds: z.array(z.string().min(1).max(60)).max(100),
	notes: z.object({
		warning: z.string().max(500).nullable(),
		general: z.string().max(2000).nullable(),
		deliveryNotes: z.string().max(500).nullable(),
		commercialReferences: z.string().max(2000).nullable(),
		collections: z.string().max(2000).nullable()
	}),
	location: geoPointSchema.nullable()
})

export const customerProfileSchema = customerProfileInputSchema.extend({
	/** «Última Venta». La pone el sistema (ventas), no se edita. */
	lastSaleAt: isoDateSchema.nullable()
})

// ---------- Proveedor

export const INCOME_TAX_WITHHOLDINGS = [
	'registered_not_subject',
	'registered_subject',
	'exempt',
	'not_registered'
] as const
export const INCOME_TAX_CONCEPTS = [
	'not_applicable',
	'goods',
	'services',
	'rentals',
	'freight',
	'professional_fees'
] as const
export const PERSON_TYPES = ['individual', 'company'] as const
export const PAYMENT_MAIL_TEMPLATES = [
	'payment_order',
	'transfer_notice',
	'withholding_certificate'
] as const
/** Qué factura A emite según ARCA (RG 5762). */
export const INVOICE_KINDS = ['standard', 'withholding', 'cbu'] as const
export const invoiceKindSchema = z.enum(INVOICE_KINDS)

export const supplierContactSchema = z.object({
	id: z.string().min(1).max(40),
	name: z.string().trim().min(1).max(80),
	role: z.string().max(60).nullable(),
	phone: z.string().max(40).nullable(),
	email: z.email().nullable()
})

export const authorizedPersonSchema = z
	.object({
		id: z.string().min(1).max(40),
		docType: docTypeSchema,
		docNumber: z.string().max(20),
		name: z.string().trim().min(1).max(80)
	})
	.superRefine((person, context) => refineDocNumber(person, context))

export const supplierProfileInputSchema = z.object({
	/** Condición de pago con alcance `suppliers`. */
	paymentTermId: z.uuid(),
	discountPct: z.number().min(0).max(100),
	/** «Cuenta Default de Compras». Por código: ver Pendientes del README. */
	purchaseAccount: z
		.object({
			code: accountCodeSchema,
			name: z.string().trim().min(1).max(80)
		})
		.nullable(),
	joinedAt: isoDateSchema,
	approved: z.boolean(),
	serviceProvider: z.boolean(),
	paymentsCustomerNumber: z.string().max(30).nullable(),
	tax: z.object({
		incomeTaxWithholding: z.enum(INCOME_TAX_WITHHOLDINGS),
		incomeTaxConcept: z.enum(INCOME_TAX_CONCEPTS),
		cai: z
			.string()
			.regex(/^\d{14}$/)
			.nullable(),
		caiExpiresAt: isoDateSchema.nullable()
	}),
	/** Rubros: códigos de la tabla `supplier_categories`. El primero es el principal. */
	categories: z.array(lookupCodeSchema).max(20),
	categoriesRaw: z.string().max(2000).nullable(),
	contacts: z.array(supplierContactSchema).max(50),
	contactsRaw: z.string().max(2000).nullable(),
	payments: z.object({
		/**
		 * En una edición, una CBU distinta de la que tiene no la reemplaza:
		 * queda en `pendingCbu` hasta que otra persona la apruebe.
		 */
		cbu: cbuSchema.nullable(),
		cbuAlias: z.string().max(40).nullable(),
		personType: z.enum(PERSON_TYPES).nullable(),
		phone: z.string().max(40).nullable(),
		email: z.email().nullable(),
		authorized: z.array(authorizedPersonSchema).max(20),
		mailTemplate: z.enum(PAYMENT_MAIL_TEMPLATES).nullable()
	}),
	notes: z.object({
		warning: z.string().max(500).nullable(),
		general: z.string().max(2000).nullable()
	})
})

export const supplierFiscalCheckSchema = z.object({
	checkedAt: isoDateSchema,
	active: z.boolean(),
	vatCondition: vatConditionSchema,
	invoiceKind: invoiceKindSchema,
	apoc: z.boolean()
})

export const pendingCbuSchema = z.object({
	cbu: cbuSchema,
	cbuAlias: z.string().max(40).nullable(),
	requestedAt: isoDateSchema,
	/**
	 * Id de quien la pidió (el BFF pone el nombre). Distinto del front, que
	 * hoy espera un nombre suelto.
	 */
	requestedBy: z.string().min(1).max(80)
})

export const supplierProfileSchema = supplierProfileInputSchema.extend({
	/** «Últ. Compra». La pone el sistema (compras). */
	lastPurchaseAt: isoDateSchema.nullable(),
	/** Lo que dijo ARCA la última vez. La pone el sistema. */
	fiscalCheck: supplierFiscalCheckSchema.nullable(),
	/** CBU nueva que espera aprobación. La pone el sistema. */
	pendingCbu: pendingCbuSchema.nullable()
})

// ---------- Transportista

export const VEHICLE_KINDS = ['truck', 'van', 'car', 'motorbike'] as const
export const vehicleKindSchema = z.enum(VEHICLE_KINDS)
/** Categoría de la caja (Código Alimentario, art. 154 bis). A y B llevan frío. */
export const COLD_CLASSES = ['A', 'B', 'C', 'D'] as const

/** Patente argentina, normalizada con espacios: AB 123 CD, ABC 123, A 123 BCD, 123 ABC. */
export const PLATE_PATTERN =
	/^([A-Z]{2} \d{3} [A-Z]{2}|[A-Z]{3} \d{3}|[A-Z] \d{3} [A-Z]{3}|\d{3} [A-Z]{3})$/

export const vehicleSchema = z.object({
	plate: z.string().regex(PLATE_PATTERN),
	kind: vehicleKindSchema,
	coldClass: z.enum(COLD_CLASSES),
	description: z.string().trim().max(60).nullable(),
	insuranceUntil: isoDateSchema.nullable(),
	inspectionUntil: isoDateSchema.nullable(),
	sanitaryPermit: z.object({
		number: z.string().trim().max(40).nullable(),
		until: isoDateSchema.nullable()
	})
})

export const carrierProfileInputSchema = z.object({
	vehicles: z.array(vehicleSchema).max(50),
	coverage: z.string().trim().max(120).nullable(),
	notes: z.string().max(2000).nullable(),
	/** La «Razón Social» de Aires tal cual («NOMBRE APELLIDO - PATENTE»). */
	airesLegalName: z.string().max(160).nullable()
})
export const carrierProfileSchema = carrierProfileInputSchema

// ---------- Vendedor

export const COMMISSION_BASES = ['invoiced', 'collected'] as const

export const salespersonProfileInputSchema = z.object({
	alias: z.string().trim().max(10).nullable(),
	joinedAt: isoDateSchema,
	zone: z.string().trim().max(60).nullable(),
	commissionPct: z.number().min(0).max(100).nullable(),
	commissionBase: z.enum(COMMISSION_BASES),
	commissionByCategory: z
		.array(
			z.object({
				category: lookupCodeSchema,
				pct: z.number().min(0).max(100)
			})
		)
		.max(20),
	notes: z.string().max(2000).nullable()
})
export const salespersonProfileSchema = salespersonProfileInputSchema

// ---------- Empleado y franquicia (sin datos propios todavía)

/**
 * Empleados y franquicias todavía no tienen datos propios acá: los de
 * empleados (`employees.md`) son de otro módulo y la franquicia espera a que
 * se defina con Big Pizza. Ver Pendientes del README de henko-contacts.
 */
export const emptyProfileSchema = z.object({}).strict()

// ---------- Rol con su perfil

/** Lo que se manda de un rol al crear o editar. */
export const contactRoleInputSchema = z.discriminatedUnion('role', [
	z.object({
		role: z.literal('customer'),
		profile: customerProfileInputSchema
	}),
	z.object({
		role: z.literal('supplier'),
		profile: supplierProfileInputSchema
	}),
	z.object({ role: z.literal('carrier'), profile: carrierProfileInputSchema }),
	z.object({
		role: z.literal('salesperson'),
		profile: salespersonProfileInputSchema
	}),
	z.object({ role: z.literal('employee'), profile: emptyProfileSchema }),
	z.object({ role: z.literal('franchise'), profile: emptyProfileSchema })
])
export type ContactRoleInput = z.infer<typeof contactRoleInputSchema>

const roleMeta = {
	/** Código de Aires por rol (6 dígitos): lo pone el sistema. `null` en empleado y franquicia. */
	code: airesCodeSchema.nullable(),
	/** Baja lógica del rol: un contacto puede dejar de ser proveedor y seguir siendo cliente. */
	status: recordStatusSchema,
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime()
}

export const contactRoleRecordSchema = z.discriminatedUnion('role', [
	z.object({
		role: z.literal('customer'),
		profile: customerProfileSchema,
		...roleMeta
	}),
	z.object({
		role: z.literal('supplier'),
		profile: supplierProfileSchema,
		...roleMeta
	}),
	z.object({
		role: z.literal('carrier'),
		profile: carrierProfileSchema,
		...roleMeta
	}),
	z.object({
		role: z.literal('salesperson'),
		profile: salespersonProfileSchema,
		...roleMeta
	}),
	z.object({
		role: z.literal('employee'),
		profile: emptyProfileSchema,
		...roleMeta
	}),
	z.object({
		role: z.literal('franchise'),
		profile: emptyProfileSchema,
		...roleMeta
	})
])
export type ContactRoleRecord = z.infer<typeof contactRoleRecordSchema>

// ---------- Contacto

const contactFields = {
	kind: contactKindSchema,
	/** Cómo se lo conoce: nombre fantasía de clientes y proveedores, nombre de transportistas y vendedores. */
	name: z.string().trim().min(1).max(160),
	/** Razón social. Obligatoria para clientes y proveedores. */
	legalName: z.string().trim().min(1).max(160).nullable(),
	/** Obligatorio salvo para empleados y franquicias. */
	docType: docTypeSchema.nullable(),
	/** Si es CUIT o CUIL: con guiones y dígito verificador válido. */
	docNumber: z.string().trim().min(1).max(20).nullable(),
	/** Obligatoria para clientes y proveedores. */
	vatCondition: vatConditionSchema.nullable(),
	contact: contactInfoSchema,
	/**
	 * Alcance: el local o franquicia dueño del contacto. `null` = de casa
	 * central (los clientes y proveedores de Big Pizza).
	 */
	localId: z.string().min(1).max(60).nullable()
}

export const contactSchema = z.object({
	id: z.uuid(),
	...contactFields,
	status: recordStatusSchema,
	/** Registro de sistema («Sin asignar»): no se edita ni se da de baja. */
	system: z.boolean(),
	roles: z.array(contactRoleRecordSchema),
	/** Sube con cada cambio. Para avisar si otro editó mientras tanto. */
	version: z.number().int().min(1),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime()
})
export type Contact = z.infer<typeof contactSchema>

const uniqueRoles = (roles: { role: ContactRole }[]) =>
	new Set(roles.map(r => r.role)).size === roles.length

/** POST /internal/contacts — alta. */
export const createContactRequestSchema = z
	.object({
		/**
		 * Id generado por quien crea (UUIDv7, para trabajar sin internet). Si
		 * ya existe, el alta no se repite: devuelve el contacto que hay.
		 */
		id: z.uuid().optional(),
		...contactFields,
		roles: z
			.array(contactRoleInputSchema)
			.min(1)
			.refine(uniqueRoles, 'Hay un rol repetido.')
	})
	.superRefine((contact, context) => refineDocNumber(contact, context))
export type CreateContactRequest = z.input<typeof createContactRequestSchema>

/**
 * PUT /internal/contacts/:id — edición. Manda todo lo común y los roles que
 * cambian: un rol que no viene queda como está (así la ficha de Clientes no
 * pisa lo de proveedor); uno que no tenía, se suma. Para sacar un rol, se le
 * da de baja (`/roles/status`).
 */
export const updateContactRequestSchema = z
	.object({
		...contactFields,
		roles: z
			.array(contactRoleInputSchema)
			.refine(uniqueRoles, 'Hay un rol repetido.'),
		/** Si viene y otro cambió el contacto mientras tanto: `common.conflict`. */
		expectedVersion: z.number().int().min(1).optional()
	})
	.superRefine((contact, context) => refineDocNumber(contact, context))
export type UpdateContactRequest = z.input<typeof updateContactRequestSchema>

export const contactResponseSchema = z.object({ contact: contactSchema })

// ---------- Listado

/**
 * GET /internal/contacts — Y entre filtros, O dentro de cada uno. Los filtros
 * de un rol (`customerTypes`, `approved`…) miran el perfil de ese rol.
 */
export const listContactsQuerySchema = z.object({
	/** Sin tildes ni mayúsculas, «contiene»: nombre, razón social, documento, mail, ciudad, códigos, patentes. */
	query: z.string().trim().max(120).optional(),
	/** Estado del contacto. Por defecto, todos. */
	statuses: listParam(recordStatusSchema),
	kinds: listParam(contactKindSchema),
	/** Tiene alguno de estos roles… */
	roles: listParam(contactRoleSchema),
	/** …y ese rol está en alguno de estos estados (sin `roles`, cualquier rol). */
	roleStatuses: listParam(recordStatusSchema),
	provinces: listParam(provinceSchema),
	vatConditions: listParam(vatConditionSchema),
	localIds: listParam(z.string().min(1).max(60)),
	customerTypes: listParam(lookupCodeSchema),
	salesChannels: listParam(lookupCodeSchema),
	priceListIds: listParam(z.string().min(1).max(60)),
	salespersonIds: listParam(z.uuid()),
	carrierIds: listParam(z.uuid()),
	/** De clientes o proveedores. */
	paymentTermIds: listParam(z.uuid()),
	supplierCategories: listParam(lookupCodeSchema),
	approved: listParam(booleanParam),
	financialBlock: listParam(booleanParam),
	vehicleKinds: listParam(vehicleKindSchema),
	limit: z.coerce.number().int().min(1).max(500).default(100),
	offset: z.coerce.number().int().min(0).default(0)
})
export type ListContactsQuery = z.output<typeof listContactsQuerySchema>

export const listContactsResponseSchema = z.object({
	contacts: z.array(contactSchema),
	/** Total con estos filtros, sin `limit` ni `offset`. */
	total: z.number().int().min(0)
})

/** GET /internal/contacts/by-doc/:digits — mismos dígitos, cualquier estado. */
export const docDigitsParamSchema = z.string().regex(/^\d{6,20}$/)
export const contactsByDocResponseSchema = z.object({
	contacts: z.array(contactSchema)
})

/** GET /internal/contacts/carriers/by-plate/:plate — quién más tiene esa patente. */
export const plateMatchesResponseSchema = z.object({
	matches: z.array(z.object({ contact: contactSchema, vehicle: vehicleSchema }))
})

// ---------- Operaciones masivas (todo o nada)

const idsSchema = z.array(z.uuid()).min(1).max(500)

/** POST /internal/contacts/archive y /restore — baja o recuperación del contacto entero. 204. */
export const contactIdsRequestSchema = z.object({ ids: idsSchema })

/** POST /internal/contacts/roles/status — baja o recuperación de un rol. 204. */
export const setRoleStatusRequestSchema = z.object({
	role: contactRoleSchema,
	ids: idsSchema,
	status: recordStatusSchema
})

/** POST /internal/contacts/customers/financial-block. 204. */
export const setFinancialBlockRequestSchema = z.object({
	ids: idsSchema,
	blocked: z.boolean()
})

/** POST /internal/contacts/customers/salesperson. `null` = sin asignar. 204. */
export const setSalespersonRequestSchema = z.object({
	ids: idsSchema,
	salespersonId: z.uuid().nullable()
})

/** POST /internal/contacts/suppliers/approved. 204. */
export const setApprovedRequestSchema = z.object({
	ids: idsSchema,
	approved: z.boolean()
})

/**
 * POST /internal/contacts/:id/cbu/approve y /reject. La aprueba otra persona
 * que la que la pidió (cuatro ojos); quien la pidió sólo puede rechazarla.
 * Responde el contacto.
 */

// ---------- Historial

export const historyEntrySchema = z.object({
	id: z.uuid(),
	at: z.iso.datetime(),
	/** Clave del catálogo de auditoría (`contacts.contact.updated`). */
	action: z.string(),
	/** Nombre legible de la acción. */
	actionLabel: z.string(),
	/**
	 * Quién. El nombre lo pone el BFF (identity). Si fue un superadmin y el
	 * que mira no lo es, viene `hidden: true` y sin id (ver README).
	 */
	actor: z.object({
		origin: z.enum(['person', 'automatic']),
		id: z.string().nullable(),
		role: z.string().nullable(),
		/** Del proceso automático (`aires-import`). */
		label: z.string().nullable(),
		hidden: z.boolean()
	}),
	/** Sólo los campos que cambiaron. */
	before: z.record(z.string(), z.unknown()).nullable(),
	after: z.record(z.string(), z.unknown()).nullable()
})
export type HistoryEntry = z.infer<typeof historyEntrySchema>

/** GET /internal/contacts/:id/history — de lo más nuevo a lo más viejo. */
export const contactHistoryResponseSchema = z.object({
	entries: z.array(historyEntrySchema)
})

// ---------- Eventos

/** Lo que viaja en los eventos: sin mails, teléfonos ni documento. */
export const contactSummarySchema = z.object({
	id: z.uuid(),
	kind: contactKindSchema,
	name: z.string(),
	localId: z.string().nullable(),
	status: recordStatusSchema,
	system: z.boolean(),
	roles: z.array(
		z.object({
			role: contactRoleSchema,
			code: z.string().nullable(),
			status: recordStatusSchema
		})
	),
	version: z.number().int()
})

/**
 * `contacts.contact.created.v1`, `contacts.contact.updated.v1`,
 * `contacts.contact.archived.v1`, `contacts.contact.restored.v1` (stream
 * `CONTACTS`). `updated` también sale cuando cambia un rol o un dato de un
 * rol por una operación masiva. El que necesita más datos, pide el contacto.
 */
export const contactEventSchema = z.object({ contact: contactSummarySchema })
export const CONTACT_EVENT_TYPES = [
	'contacts.contact.created.v1',
	'contacts.contact.updated.v1',
	'contacts.contact.archived.v1',
	'contacts.contact.restored.v1'
] as const
export type ContactEventType = (typeof CONTACT_EVENT_TYPES)[number]
