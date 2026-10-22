import { describe, expect, it } from 'vitest'

import {
	ingestFeedbackRequestSchema,
	submitFeedbackSchema,
	updateReportRequestSchema
} from './index.js'

const report = {
	id: '0192b0a1-7c00-7000-8000-000000000001',
	kind: 'bug',
	urgency: 'high',
	description: 'No me deja guardar el contacto',
	context: {
		path: '/contactos',
		module: 'contacts',
		appVersion: '0.1.0',
		viewport: '375x812',
		userAgent: 'Mozilla/5.0',
		traceIds: ['4bf92f3577b34da6a3ce929d0e0e4736'],
		errorRefs: ['H-4BF92F']
	},
	screenshot: null,
	createdAt: '2026-10-21T12:00:00.000Z'
}

describe('contrato de la Console', () => {
	it('un reporte válido pasa y uno con código de error mal formado no', () => {
		expect(submitFeedbackSchema.parse(report)).toEqual(report)
		expect(
			submitFeedbackSchema.safeParse({
				...report,
				context: { ...report.context, errorRefs: ['4bf92f'] }
			}).success
		).toBe(false)
	})

	it('la captura tiene tope de tamaño y tiene que ser base64', () => {
		const huge = 'A'.repeat(3 * 1024 * 1024)
		expect(
			submitFeedbackSchema.safeParse({
				...report,
				screenshot: { mimeType: 'image/png', dataBase64: huge }
			}).success
		).toBe(false)
		expect(
			submitFeedbackSchema.safeParse({
				...report,
				screenshot: { mimeType: 'image/png', dataBase64: '<script>' }
			}).success
		).toBe(false)
	})

	it('el BFF suma quién reporta; la instancia no viaja en el cuerpo', () => {
		const ingest = ingestFeedbackRequestSchema.parse({
			...report,
			reporter: { id: 'u1', name: 'Ana', role: 'manager' },
			localId: 'loc-1',
			instance: 'otra'
		})
		expect(ingest).not.toHaveProperty('instance')
	})

	it('el PR tiene que ser de GitHub y hay que mandar algo', () => {
		expect(updateReportRequestSchema.safeParse({}).success).toBe(false)
		expect(
			updateReportRequestSchema.safeParse({ prUrl: 'https://evil.test/x' })
				.success
		).toBe(false)
		expect(
			updateReportRequestSchema.safeParse({
				status: 'resolved',
				prUrl: 'https://github.com/Henko-Software/henko-web/pull/3'
			}).success
		).toBe(true)
	})
})
