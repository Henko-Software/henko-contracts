import { describe, expect, it } from 'vitest'

import {
	FINAL_FLOW_STATUSES,
	FLOW_STATUS_LABELS,
	FLOW_STATUSES,
	listFlowsQuerySchema,
	startFlowRequestSchema
} from './index.js'

const V7 = '0192b0a1-7c00-7000-8000-000000000001'
const V4 = '0192b0a1-7c00-4000-8000-000000000001'

describe('contrato del orquestador', () => {
	it('el id del comando tiene que ser UUIDv7', () => {
		const base = { flow: 'identity.user_onboarding', input: {} }
		expect(
			startFlowRequestSchema.safeParse({ ...base, commandId: V7 }).success
		).toBe(true)
		expect(
			startFlowRequestSchema.safeParse({ ...base, commandId: V4 }).success
		).toBe(false)
	})

	it('los filtros aceptan coma o parámetro repetido', () => {
		expect(
			listFlowsQuerySchema.parse({ status: 'running,failed' }).status
		).toEqual(['running', 'failed'])
		expect(
			listFlowsQuerySchema.parse({ status: ['running', 'cancelled'] }).status
		).toEqual(['running', 'cancelled'])
		expect(listFlowsQuerySchema.safeParse({ status: 'perdido' }).success).toBe(
			false
		)
		expect(listFlowsQuerySchema.parse({}).limit).toBe(50)
	})

	it('cada estado tiene nombre y los finales son estados', () => {
		for (const status of FLOW_STATUSES) {
			expect(FLOW_STATUS_LABELS[status]).toBeTruthy()
		}
		for (const status of FINAL_FLOW_STATUSES) {
			expect(FLOW_STATUSES).toContain(status)
		}
	})
})
