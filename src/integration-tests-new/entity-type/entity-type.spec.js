const request = require('supertest')
const Ajv = require('ajv')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'
const ajv = new Ajv({ strict: false })

const schemas = require('./schemas/entity-type.schemas.json')

describe('entity-type endpoints generated from api-doc.yaml', () => {
	describe('POST /mentoring/v1/entity-type/create', () => {
		test('should return 201', async () => {
			const url = `/mentoring/v1/entity-type/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					value: 'string',
					label: 'string',
					allow_filtering: 'string',
					data_type: 'string',
					model_names: ['string'],
					required: true,
					status: 'string',
					type: 'string',
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_entity-type_create']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})

	describe('GET /mentoring/v1/entity-type/read', () => {
		test('should return 201', async () => {
			const url = `/mentoring/v1/entity-type/read`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					value: ['string'],
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_entity-type_read']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})

	describe('POST /mentoring/v1/entity-type/update/{id}', () => {
		test('should return 201', async () => {
			const url = `/mentoring/v1/entity-type/update/{id}`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					value: 'string',
					label: 'string',
					status: 'string',
					type: 'string',
					data_type: 'string',
					model_names: ['string'],
					allow_filtering: true,
					required: true,
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_entity-type_update_id']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})

	describe('DELETE /mentoring/v1/entity-type/delete/{id}', () => {
		test('should return 201', async () => {
			const url = `/mentoring/v1/entity-type/delete/{id}`
			let req = request(BASE).delete(url)
			req = req.set('x-auth-token', 'string')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['DELETE_mentoring_v1_entity-type_delete_id']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})
})
