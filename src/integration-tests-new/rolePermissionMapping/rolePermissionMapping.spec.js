const request = require('supertest')
const Ajv = require('ajv')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'
const ajv = new Ajv({ strict: false })

const schemas = require('./schemas/rolePermissionMapping.schemas.json')

describe('rolePermissionMapping endpoints generated from api-doc.yaml', () => {
	describe('POST /mentoring/v1/rolePermissionMapping/create/{role_id}', () => {
		test('should return 201', async () => {
			const url = `/mentoring/v1/rolePermissionMapping/create/{role_id}`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					permission_id: 1,
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_rolePermissionMapping_create_role_id']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})

		test('should return 400/422 for invalid body', async () => {
			const url = `/mentoring/v1/rolePermissionMapping/create/{role_id}`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req.send({}).set('Content-Type', 'application/json')
			const res = await req
			expect([400, 422]).toContain(res.status)
		})
	})

	describe('POST /mentoring/v1/rolePermissionMapping/delete/{role_id}', () => {
		test('should return 201', async () => {
			const url = `/mentoring/v1/rolePermissionMapping/delete/{role_id}`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					permission_id: 1,
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_rolePermissionMapping_delete_role_id']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})

		test('should return 400/422 for invalid body', async () => {
			const url = `/mentoring/v1/rolePermissionMapping/delete/{role_id}`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req.send({}).set('Content-Type', 'application/json')
			const res = await req
			expect([400, 422]).toContain(res.status)
		})
	})
})
