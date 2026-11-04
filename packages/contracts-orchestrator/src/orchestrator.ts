import { z } from 'zod'

/**
 * Contrato interno de `orchestrator`: el servicio que dirige los flujos que
 * cruzan módulos (sagas con pasos, reintentos y compensación). Lo llama el
 * BFF con un token interno firmado (`@henko-software/service-auth`), con
 * audiencia `orchestrator`. Las rutas van bajo `/internal`.
 *
 * Los ids son UUIDv7 y las fechas, ISO en UTC.
 */

/** Id que genera quien crea el dato (la caja, el BFF, un módulo). */
export const uuidv7Schema = z.uuid({ version: 'v7' })

// ---------- Catálogos

export const FLOW_STATUSES = [
	'running',
	'compensating',
	'completed',
	'compensated',
	'failed',
	'cancelled'
] as const
export const flowStatusSchema = z.enum(FLOW_STATUSES)
export type FlowStatus = z.infer<typeof flowStatusSchema>
export const FLOW_STATUS_LABELS: Record<FlowStatus, string> = {
	running: 'En curso',
	compensating: 'Deshaciendo lo hecho',
	completed: 'Terminado',
	compensated: 'Falló y se deshizo lo hecho',
	failed: 'Falló: necesita que lo mire una persona',
	cancelled: 'Cancelado'
}
/** Un flujo en estos estados ya no se mueve. */
export const FINAL_FLOW_STATUSES: readonly FlowStatus[] = [
	'completed',
	'compensated',
	'failed',
	'cancelled'
]

/** `action` hace el paso; `compensation` lo deshace si el flujo falla. */
export const STEP_PHASES = ['action', 'compensation'] as const
export const stepPhaseSchema = z.enum(STEP_PHASES)
export type StepPhase = z.infer<typeof stepPhaseSchema>

export const STEP_STATUSES = [
	'running',
	'waiting',
	'succeeded',
	'failed'
] as const
export const stepStatusSchema = z.enum(STEP_STATUSES)
export type StepStatus = z.infer<typeof stepStatusSchema>
export const STEP_STATUS_LABELS: Record<StepStatus, string> = {
	running: 'Corriendo',
	waiting: 'Esperando para reintentar',
	succeeded: 'Hecho',
	failed: 'Falló'
}

/**
 * Cómo terminó un intento: `retryable` se vuelve a probar (caída, 5xx,
 * tiempo agotado); `permanent` no (el módulo lo rechazó).
 */
export const ATTEMPT_OUTCOMES = ['succeeded', 'retryable', 'permanent'] as const
export const attemptOutcomeSchema = z.enum(ATTEMPT_OUTCOMES)

// ---------- Piezas

/**
 * Quién arrancó el flujo. `null` cuando quien mira no puede verlo (lo hizo
 * un superadmin y quien mira no lo es): el dato queda, se calla quién.
 */
export const flowActorSchema = z.discriminatedUnion('origin', [
	z.object({
		origin: z.literal('person'),
		id: z.string().min(1),
		role: z.string().min(1)
	}),
	z.object({ origin: z.literal('automatic'), label: z.string().min(1) })
])
export type FlowActor = z.infer<typeof flowActorSchema>

/** Qué lo disparó: un comando (con su id) o un evento de un módulo. */
export const flowTriggerSchema = z.object({
	kind: z.enum(['command', 'event']),
	/** Tipo del evento (`identity.user.created.v1`) o del comando. */
	type: z.string().min(1),
	/** Id del comando o del evento: con él, repetirlo no arranca otro flujo. */
	id: z.uuid()
})
export type FlowTrigger = z.infer<typeof flowTriggerSchema>

/** El error que paró el flujo, con la clave del módulo que lo dio. */
export const flowErrorSchema = z.object({
	step: z.string().min(1),
	code: z.string().min(1),
	message: z.string()
})
export type FlowError = z.infer<typeof flowErrorSchema>

export const flowSummarySchema = z.object({
	id: uuidv7Schema,
	/** Nombre estable del flujo: `identity.user_onboarding`. */
	name: z.string().min(1),
	version: z.number().int().positive(),
	/** Nombre para mostrar, en español. */
	label: z.string(),
	status: flowStatusSchema,
	localId: z.string().nullable(),
	correlationId: z.string().nullable(),
	/** Traza de OpenTelemetry donde nació el flujo (32 hex). */
	traceId: z
		.string()
		.regex(/^[0-9a-f]{32}$/)
		.nullable(),
	trigger: flowTriggerSchema,
	startedBy: flowActorSchema.nullable(),
	/** Paso por el que va (0 = el primero). */
	currentStep: z.number().int().nonnegative(),
	totalSteps: z.number().int().nonnegative(),
	error: flowErrorSchema.nullable(),
	cancelReason: z.string().nullable(),
	/** Fecha del dispositivo que mandó el comando (sin internet llega tarde). */
	issuedAt: z.iso.datetime().nullable(),
	/** Fecha en que lo recibió el servidor. */
	receivedAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
	finishedAt: z.iso.datetime().nullable()
})
export type FlowSummary = z.infer<typeof flowSummarySchema>

export const flowStepSchema = z.object({
	/** Posición del paso en la definición. */
	index: z.number().int().nonnegative(),
	name: z.string().min(1),
	label: z.string(),
	phase: stepPhaseSchema,
	status: stepStatusSchema,
	/** Id del comando que se le manda al módulo; es el mismo en cada reintento. */
	commandId: uuidv7Schema,
	attempts: z.number().int().nonnegative(),
	error: flowErrorSchema.omit({ step: true }).nullable(),
	startedAt: z.iso.datetime(),
	finishedAt: z.iso.datetime().nullable(),
	nextAttemptAt: z.iso.datetime().nullable()
})
export type FlowStep = z.infer<typeof flowStepSchema>

export const flowAttemptSchema = z.object({
	stepIndex: z.number().int().nonnegative(),
	phase: stepPhaseSchema,
	attempt: z.number().int().positive(),
	outcome: attemptOutcomeSchema,
	error: flowErrorSchema.omit({ step: true }).nullable(),
	startedAt: z.iso.datetime(),
	finishedAt: z.iso.datetime(),
	traceId: z.string().nullable()
})
export type FlowAttempt = z.infer<typeof flowAttemptSchema>

export const flowDetailSchema = flowSummarySchema.extend({
	/** Lo que recibió el flujo al arrancar (ya validado por su definición). */
	input: z.unknown(),
	steps: z.array(flowStepSchema),
	attempts: z.array(flowAttemptSchema)
})
export type FlowDetail = z.infer<typeof flowDetailSchema>

// ---------- Rutas

/** GET /internal/flow-definitions — los flujos que conoce esta versión. */
export const flowDefinitionSchema = z.object({
	name: z.string().min(1),
	version: z.number().int().positive(),
	label: z.string(),
	description: z.string(),
	/** Roles que pueden arrancarlo por `POST /internal/flows`. Vacío = sólo eventos. */
	startableBy: z.array(z.string()),
	/** Eventos que lo arrancan solos. */
	triggers: z.array(z.string()),
	steps: z.array(
		z.object({
			name: z.string().min(1),
			label: z.string(),
			/** Si tiene compensación (se deshace si el flujo falla después). */
			compensable: z.boolean()
		})
	)
})
export type FlowDefinitionDto = z.infer<typeof flowDefinitionSchema>
export const listFlowDefinitionsResponseSchema = z.object({
	definitions: z.array(flowDefinitionSchema)
})

/**
 * Lista que acepta `a,b` o el parámetro repetido (`?status=a&status=b`). Dentro
 * de un filtro es O; entre filtros, Y.
 */
const multiValue = <T extends z.ZodType<unknown, string>>(item: T) =>
	z
		.union([z.string(), z.array(z.string())])
		.transform(value =>
			(Array.isArray(value) ? value : [value])
				.flatMap(v => v.split(','))
				.map(v => v.trim())
				.filter(v => v.length > 0)
		)
		.pipe(z.array(item))

/** GET /internal/flows — los más nuevos primero, por cursor. */
export const listFlowsQuerySchema = z.object({
	status: multiValue(flowStatusSchema).optional(),
	name: multiValue(z.string().min(1).max(120)).optional(),
	localId: multiValue(z.string().min(1).max(120)).optional(),
	/** El `nextCursor` de la página anterior. */
	cursor: uuidv7Schema.optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50)
})
export type ListFlowsQuery = z.infer<typeof listFlowsQuerySchema>
export const listFlowsResponseSchema = z.object({
	flows: z.array(flowSummarySchema),
	nextCursor: uuidv7Schema.nullable()
})

/** GET /internal/flows/:id */
export const getFlowResponseSchema = z.object({ flow: flowDetailSchema })

/**
 * POST /internal/flows — arranca un flujo. El `commandId` lo genera quien
 * manda el comando (UUIDv7): si llega dos veces, cuenta una (responde el
 * mismo flujo con `created: false`). 201 si lo creó, 200 si ya estaba.
 */
export const startFlowRequestSchema = z.object({
	flow: z.string().min(1).max(120),
	input: z.unknown(),
	commandId: uuidv7Schema,
	/** Fecha del dispositivo cuando se generó el comando (puede ser vieja). */
	issuedAt: z.iso.datetime().optional()
})
export type StartFlowRequest = z.infer<typeof startFlowRequestSchema>
export const startFlowResponseSchema = z.object({
	flow: flowSummarySchema,
	created: z.boolean()
})

/**
 * POST /internal/flows/:id/cancel — pide cancelar: el flujo deshace lo hecho
 * (compensa) y queda `cancelled`. Idempotente: cancelar dos veces es una.
 */
export const cancelFlowRequestSchema = z.object({
	reason: z.string().trim().min(1).max(300)
})
export const cancelFlowResponseSchema = z.object({ flow: flowSummarySchema })

// ---------- Comandos a los módulos

/**
 * Cabecera con el id del comando en cada llamada del orquestador a un
 * módulo. Es el mismo en cada reintento: el módulo, si ya lo hizo, responde
 * lo mismo sin hacerlo de nuevo.
 */
export const IDEMPOTENCY_HEADER = 'idempotency-key'

/**
 * Comando encolado sin internet (borrador: todavía no lo recibe ninguna
 * ruta). La caja lo genera con su id y su fecha, lo guarda en su cola y lo
 * sube cuando vuelve la conexión: puede llegar tarde, repetido y desordenado.
 */
export const queuedCommandSchema = z.object({
	commandId: uuidv7Schema,
	/** `sales.sale.register`, por ejemplo. */
	type: z.string().min(1).max(120),
	localId: z.string().min(1),
	deviceId: z.uuid(),
	/** Orden dentro de la cola de esa caja: 1, 2, 3… */
	sequence: z.number().int().positive(),
	issuedAt: z.iso.datetime(),
	payload: z.unknown()
})
export type QueuedCommand = z.infer<typeof queuedCommandSchema>

// ---------- Errores que puede devolver

/** Claves de error propias del orquestador (además de las `common.*`). */
export const ORCHESTRATOR_ERRORS = [
	'orchestrator.flow_not_found',
	'orchestrator.unknown_flow',
	'orchestrator.flow_not_startable',
	'orchestrator.command_conflict',
	'orchestrator.flow_finished'
] as const
export type OrchestratorErrorKey = (typeof ORCHESTRATOR_ERRORS)[number]

// ---------- Eventos (stream `ORCHESTRATOR`, subjects `orchestrator.>`)

export const ORCHESTRATOR_EVENTS = {
	flowStarted: 'orchestrator.flow.started.v1',
	flowCompleted: 'orchestrator.flow.completed.v1',
	flowCompensated: 'orchestrator.flow.compensated.v1',
	flowFailed: 'orchestrator.flow.failed.v1',
	flowCancelled: 'orchestrator.flow.cancelled.v1',
	noticeRaised: 'orchestrator.notice.raised.v1'
} as const

/** `orchestrator.flow.started.v1` */
export const flowStartedEventSchema = z.object({
	flow: z.object({
		id: uuidv7Schema,
		name: z.string(),
		version: z.number().int().positive(),
		localId: z.string().nullable(),
		trigger: flowTriggerSchema
	})
})

/** `orchestrator.flow.{completed,compensated,failed,cancelled}.v1` */
export const flowFinishedEventSchema = z.object({
	flow: z.object({
		id: uuidv7Schema,
		name: z.string(),
		version: z.number().int().positive(),
		status: flowStatusSchema,
		localId: z.string().nullable(),
		error: flowErrorSchema.nullable()
	})
})

/**
 * `orchestrator.notice.raised.v1` — un aviso para personas (lo muestra quien
 * se ocupe de las notificaciones). Nunca nombra a quien lo causó.
 */
export const noticeRaisedEventSchema = z.object({
	notice: z.object({
		id: uuidv7Schema,
		/** Qué tipo de aviso es: `identity.user_created`. */
		kind: z.string().min(1),
		title: z.string().min(1),
		message: z.string().min(1),
		/** Roles que lo tienen que ver. */
		audienceRoles: z.array(z.string().min(1)),
		/** Locales a los que se refiere. Vacío = toda la instancia. */
		localIds: z.array(z.string()),
		subject: z.object({ type: z.string().min(1), id: z.string().min(1) }),
		flowId: uuidv7Schema
	})
})
export type NoticeRaisedEvent = z.infer<typeof noticeRaisedEventSchema>
