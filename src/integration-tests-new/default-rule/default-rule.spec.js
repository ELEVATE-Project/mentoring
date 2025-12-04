const request = require('supertest')
const Ajv = require('ajv')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'
const ajv = new Ajv({ strict: false })

const schemas = require('./schemas/default-rule.schemas.json')

describe('default-rule endpoints generated from api-doc.yaml', () => {
	describe('POST /mentoring/v1/default-rule/create', () => {
		test('should return 201', async () => {
			const url = `/mentoring/v1/default-rule/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					type: 'mentor',
					target_field: 'string',
					is_target_from_sessions_mentor: true,
					requester_field: 'string',
					operator: 'equals',
					requester_roles: ['ALL'],
					requester_roles_config: {
						exclude: false,
					},
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_default-rule_create']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})

		test('should return 400/422 for invalid body', async () => {
			const url = `/mentoring/v1/default-rule/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req.send({}).set('Content-Type', 'application/json')
			const res = await req
			expect([400, 422]).toContain(res.status)
		})
	})

	describe('GET /mentoring/v1/default-rule/read', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/default-rule/read`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', 'string')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_default-rule_read']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})

	describe('PATCH /mentoring/v1/default-rule/update/{id}', () => {
		test('should return 202', async () => {
			const url = `/mentoring/v1/default-rule/update/{id}?id=1`
			let req = request(BASE).patch(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					type: 'mentor',
					target_field: 'string',
					is_target_from_sessions_mentor: false,
					requester_field: 'string',
					operator: 'equals',
					requester_roles: ['ALL'],
					requester_roles_config: {
						exclude: false,
					},
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['PATCH_mentoring_v1_default-rule_update_id']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})

	describe('DELETE /mentoring/v1/default-rule/delete/{id}', () => {
		test('should return 202', async () => {
			const url = `/mentoring/v1/default-rule/delete/{id}?id=1`
			let req = request(BASE).delete(url)
			req = req.set('x-auth-token', 'string')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['DELETE_mentoring_v1_default-rule_delete_id']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})
})
