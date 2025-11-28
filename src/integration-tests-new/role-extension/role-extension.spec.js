const request = require('supertest')
const Ajv = require('ajv')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'
const ajv = new Ajv({ strict: false })

const schemas = require('./schemas/role-extension.schemas.json')

describe('role-extension endpoints generated from api-doc.yaml', () => {
	describe('POST /mentoring/v1/role-extension/create', () => {
		test('should return 201', async () => {
			const url = `/mentoring/v1/role-extension/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			req = req.set('x-auth-token', 'test-token')
			req = req
				.send({
					title: 'string',
					label: 'string',
					scope: 'string',
					organization_id: 'string',
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_role-extension_create']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/role-extension/create`
			const res = await request(BASE).post(url)
			expect([401, 403]).toContain(res.status)
		})

		test('should return 400/422 for invalid body', async () => {
			const url = `/mentoring/v1/role-extension/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			req = req.set('x-auth-token', 'test-token')
			req = req.send({}).set('Content-Type', 'application/json')
			const res = await req
			expect([400, 422]).toContain(res.status)
		})
	})

	describe('GET /mentoring/v1/role-extension/read', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/role-extension/read?title=mentee`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_role-extension_read']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})

	describe('POST /mentoring/v1/role-extension/update', () => {
		test('should return 201', async () => {
			const url = `/mentoring/v1/role-extension/update?title=mentee`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			req = req
				.send({
					label: 'string',
					scope: 'string',
					organization_id: 'string',
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_role-extension_update']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})

		test('should return 400/422 for invalid body', async () => {
			const url = `/mentoring/v1/role-extension/update?title=mentee`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			req = req.send({}).set('Content-Type', 'application/json')
			const res = await req
			expect([400, 422]).toContain(res.status)
		})
	})

	describe('DELETE /mentoring/v1/role-extension/delete', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/role-extension/delete?title=mentee`
			let req = request(BASE).delete(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			req = req.set('x-auth-token', 'test-token')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['DELETE_mentoring_v1_role-extension_delete']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/role-extension/delete?title=mentee`
			const res = await request(BASE).delete(url)
			expect([401, 403]).toContain(res.status)
		})
	})
})
