const request = require('supertest')
const Ajv = require('ajv')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'
const ajv = new Ajv({ strict: false })

const schemas = require('./schemas/questions.schemas.json')

describe('questions endpoints generated from api-doc.yaml', () => {
	describe('POST /mentoring/v1/questions/create', () => {
		test('should return 201', async () => {
			const url = `/mentoring/v1/questions/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					name: 'keyvalue',
					question: 'To what extent did you feel comfortable sharing your thoughts in the session?',
					type: 'rating',
					options: null,
					no_of_stars: 5,
					status: 'active',
					category: null,
					rendering_data: {
						value: '',
						class: 'ion-margin',
						disabled: false,
						noOfstars: '5',
						position: 'floating',
						validation: {
							required: false,
						},
					},
					meta: null,
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['POST_/mentoring/v1/questions/create']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/questions/create`
			const res = await request(BASE).post(url)
			expect([401, 403]).toContain(res.status)
		})
	})

	describe('PUT /mentoring/v1/questions/update/{QuestionId}', () => {
		test('should return 202', async () => {
			const url = `/mentoring/v1/questions/update/1`
			let req = request(BASE).put(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					name: 'keyvalue',
					question: 'To what extent were you able to learn new skills in the session Org?',
					type: 'rating',
					options: null,
					no_of_stars: 5,
					status: 'active',
					category: {
						evaluating: 'mentor',
					},
					rendering_data: {
						validators: {
							required: true,
						},
					},
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['PUT_/mentoring/v1/questions/update/{QuestionId}']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/questions/update/1`
			const res = await request(BASE).put(url)
			expect([401, 403]).toContain(res.status)
		})
	})

	describe('GET /mentoring/v1/questions/read/{QuestionId}', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/questions/read/1`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', 'string')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['GET_/mentoring/v1/questions/read/{QuestionId}']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/questions/read/1`
			const res = await request(BASE).get(url)
			expect([401, 403]).toContain(res.status)
		})
	})
})
