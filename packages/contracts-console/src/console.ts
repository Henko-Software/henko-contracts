import { z } from 'zod'

/**
 * Contrato de la Henko Console: la herramienta interna del equipo para
 * recibir el feedback de cada instancia, investigarlo con su traza y armar el
 * pedido para que Claude lo arregle.
 *
 * Dos puertas:
 * - `/internal/feedback`: el BFF de cada instancia manda los reportes, con un
 *   token interno firmado como `bff.<instancia>` (así la Console sabe de qué
 *   cliente viene sin creerle al cuerpo).
 * - `/api/*`: la usa la web de la Console, con la cookie
 *   `henko_console_session`.
 *
 * Los ids son UUIDv7 y las fechas, ISO en UTC.
 */

// ---------- Catálogos

export const FEEDBACK_KINDS = ['bug', 'confusing', 'missing', 'idea'] as const
export const feedbackKindSchema = z.enum(FEEDBACK_KINDS)
export type FeedbackKind = z.infer<typeof feedbackKindSchema>
export const FEEDBACK_KIND_LABELS: Record<FeedbackKind, string> = {
	bug: 'Algo falló',
	confusing: 'No se entiende',
	missing: 'Falta algo',
	idea: 'Mejora'
}

export const FEEDBACK_URGENCIES = ['low', 'medium', 'high'] as const
export const feedbackUrgencySchema = z.enum(FEEDBACK_URGENCIES)
export type FeedbackUrgency = z.infer<typeof feedbackUrgencySchema>
export const FEEDBACK_URGENCY_LABELS: Record<FeedbackUrgency, string> = {
	low: 'Baja',
	medium: 'Media',
	high: 'Alta'
}

export const REPORT_STATUSES = [
	'new',
	'in_progress',
	'resolved',
	'discarded'
] as const
export const reportStatusSchema = z.enum(REPORT_STATUSES)
export type ReportStatus = z.infer<typeof reportStatusSchema>
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
	new: 'Nuevo',
	in_progress: 'En curso',
	resolved: 'Resuelto',
	discarded: 'Descartado'
}

/** El código que ve la persona en un error: `H-` + 6 hex del trace id. */
export const errorRefSchema = z.string().regex(/^H-[0-9A-F]{6}$/)
/** Trace id de OpenTelemetry: 32 hex en minúscula. */
export const traceIdSchema = z.string().regex(/^[0-9a-f]{32}$/)
/** Nombre de instancia: `bigpizza`, `dev`. */
export const instanceIdSchema = z.string().regex(/^[a-z][a-z0-9-]{1,39}$/)

// ---------- Lo que manda el front (a través del BFF)

/** Captura de pantalla: hasta 2 MB de imagen, en base64. */
export const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024
export const screenshotSchema = z.object({
	mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
	dataBase64: z
		.string()
		.max(Math.ceil(MAX_SCREENSHOT_BYTES / 3) * 4)
		.regex(/^[A-Za-z0-9+/]+={0,2}$/)
})
export type Screenshot = z.infer<typeof screenshotSchema>

/** Lo que el widget suma solo: nadie lo tiene que anotar a mano. */
export const feedbackContextSchema = z.object({
	path: z.string().max(500),
	/** Sección del front (`contacts`), si la ruta la define. */
	module: z.string().max(50).nullable(),
	appVersion: z.string().max(50),
	viewport: z.string().max(20),
	userAgent: z.string().max(500),
	/** Últimas trazas de la sesión, la más nueva primero. */
	traceIds: z.array(traceIdSchema).max(20),
	/** Últimos códigos de error que vio la persona, el más nuevo primero. */
	errorRefs: z.array(errorRefSchema).max(20)
})
export type FeedbackContext = z.infer<typeof feedbackContextSchema>

/**
 * Un reporte como lo arma el front. El `id` lo genera el front (UUIDv7):
 * si se reintenta sin internet, el mismo reporte no entra dos veces.
 */
export const submitFeedbackSchema = z.object({
	id: z.uuid(),
	kind: feedbackKindSchema,
	urgency: feedbackUrgencySchema,
	description: z.string().trim().min(5).max(2000),
	context: feedbackContextSchema,
	screenshot: screenshotSchema.nullable(),
	/** Cuándo lo escribió la persona (puede llegar más tarde, sin internet). */
	createdAt: z.iso.datetime()
})
export type SubmitFeedback = z.infer<typeof submitFeedbackSchema>

// ---------- BFF → Console: POST /internal/feedback

export const reporterSchema = z.object({
	id: z.string().min(1),
	name: z.string().max(120),
	role: z.string().min(1)
})
export type Reporter = z.infer<typeof reporterSchema>

/** La instancia sale del emisor del token (`bff.<instancia>`), no del cuerpo. */
export const ingestFeedbackRequestSchema = submitFeedbackSchema.extend({
	reporter: reporterSchema,
	localId: z.string().min(1).nullable()
})
export type IngestFeedbackRequest = z.infer<typeof ingestFeedbackRequestSchema>

/** 201 si es nuevo, 200 si ese `id` ya había llegado. */
export const ingestFeedbackResponseSchema = z.object({
	id: z.uuid(),
	duplicate: z.boolean()
})

// ---------- API de la web de la Console (/api)

export const CONSOLE_SESSION_COOKIE = 'henko_console_session'

/** POST /api/auth/login */
export const consoleLoginRequestSchema = z.object({
	email: z.email(),
	password: z.string().min(1).max(200)
})

export const consoleUserSchema = z.object({
	id: z.uuid(),
	email: z.email(),
	name: z.string().min(1).max(120)
})
export type ConsoleUser = z.infer<typeof consoleUserSchema>

/** POST /api/auth/login · GET /api/me */
export const consoleMeResponseSchema = z.object({ user: consoleUserSchema })

/** POST /api/auth/logout — 204. */

/** GET /api/instances */
export const consoleInstanceSchema = z.object({
	id: instanceIdSchema,
	name: z.string(),
	/** Si la Console puede leer las trazas de esa instancia. */
	tracesEnabled: z.boolean()
})
export const instancesResponseSchema = z.object({
	instances: z.array(consoleInstanceSchema)
})

export const reportSummarySchema = z.object({
	id: z.uuid(),
	instance: instanceIdSchema,
	kind: feedbackKindSchema,
	urgency: feedbackUrgencySchema,
	status: reportStatusSchema,
	/** Primeras líneas, para la lista. */
	excerpt: z.string(),
	reporterName: z.string(),
	path: z.string(),
	module: z.string().nullable(),
	errorRefs: z.array(errorRefSchema),
	hasScreenshot: z.boolean(),
	createdAt: z.iso.datetime(),
	receivedAt: z.iso.datetime()
})
export type ReportSummary = z.infer<typeof reportSummarySchema>

export const reportSchema = reportSummarySchema
	.omit({ excerpt: true, reporterName: true })
	.extend({
		description: z.string(),
		reporter: reporterSchema,
		localId: z.string().nullable(),
		context: feedbackContextSchema,
		/** El PR que lo arregla, si ya hay. */
		prUrl: z.url().nullable(),
		statusChangedAt: z.iso.datetime()
	})
export type Report = z.infer<typeof reportSchema>

/** GET /api/reports — más nuevos primero, paginado por cursor. */
export const listReportsQuerySchema = z.object({
	status: reportStatusSchema.optional(),
	kind: feedbackKindSchema.optional(),
	urgency: feedbackUrgencySchema.optional(),
	instance: instanceIdSchema.optional(),
	/** Busca en la descripción, la ruta y los códigos de error. */
	q: z.string().trim().max(100).optional(),
	cursor: z.string().max(200).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(30)
})
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>
export const listReportsResponseSchema = z.object({
	reports: z.array(reportSummarySchema),
	nextCursor: z.string().nullable()
})

/** GET /api/reports/:id */
export const reportResponseSchema = z.object({ report: reportSchema })

/** GET /api/reports/:id/screenshot — la imagen, con su content-type. */

/** PATCH /api/reports/:id */
export const updateReportRequestSchema = z
	.object({
		status: reportStatusSchema.optional(),
		prUrl: z.url().startsWith('https://github.com/').nullable().optional()
	})
	.refine(value => value.status !== undefined || value.prUrl !== undefined, {
		message: 'Mandá el estado o el PR.'
	})

/**
 * POST /api/reports/:id/prompt — el pedido para Claude, armado con el
 * reporte, sus errores y su traza. `repos` son los repos que probablemente
 * haya que tocar (el front siempre, más los servicios que aparecen en la
 * traza).
 */
export const reportPromptResponseSchema = z.object({
	prompt: z.string(),
	repos: z.array(z.string())
})

// ---------- Trazas

export const spanStatusSchema = z.enum(['ok', 'error', 'unset'])

export const traceSpanSchema = z.object({
	spanId: z.string(),
	parentSpanId: z.string().nullable(),
	name: z.string(),
	service: z.string(),
	/** Desde el inicio de la traza. */
	startOffsetMs: z.number().nonnegative(),
	durationMs: z.number().nonnegative(),
	status: spanStatusSchema,
	/** Código que vio la persona, si este span terminó en error. */
	errorRef: errorRefSchema.nullable(),
	errorCode: z.string().nullable(),
	/** Atributos útiles para investigar, sin datos personales. */
	attributes: z.record(
		z.string(),
		z.union([z.string(), z.number(), z.boolean()])
	)
})
export type TraceSpan = z.infer<typeof traceSpanSchema>

export const traceSchema = z.object({
	traceId: traceIdSchema,
	instance: instanceIdSchema,
	startedAt: z.iso.datetime(),
	durationMs: z.number().nonnegative(),
	services: z.array(z.string()),
	spans: z.array(traceSpanSchema)
})
export type Trace = z.infer<typeof traceSchema>

/**
 * GET /api/traces/:query?instance=<id> — `query` es un código `H-XXXXXX` o
 * un trace id completo.
 */
export const traceResponseSchema = z.object({ trace: traceSchema })

// ---------- Errores

export const CONSOLE_ERRORS = [
	'console.invalid_credentials',
	'console.report_not_found',
	'console.unknown_instance',
	'console.trace_not_found',
	'console.traces_unavailable'
] as const
export type ConsoleErrorKey = (typeof CONSOLE_ERRORS)[number]
