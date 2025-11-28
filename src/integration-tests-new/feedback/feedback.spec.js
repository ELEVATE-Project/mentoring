const request = require('supertest')
const Ajv = require('ajv')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'
const ajv = new Ajv({ strict: false })

const schemas = require('./schemas/feedback.schemas.json')

describe('feedback endpoints generated from api-doc.yaml', () => {
	describe('GET /mentoring/v1/feedback/forms/{SessionId}', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/feedback/forms/1`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', 'string')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['GET_/mentoring/v1/feedback/forms/{SessionId}']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/feedback/forms/1`
			const res = await request(BASE).get(url)
			expect([401, 403]).toContain(res.status)
		})
	})

	describe('POST /mentoring/v1/feedback/submit/{SessionId}', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/feedback/submit/1`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					feedbacks: [
						{
							question_id: '1',
							value: '1',
						},
					],
					feedback_as: 'mentee',
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['POST_/mentoring/v1/feedback/submit/{SessionId}']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/feedback/submit/1`
			const res = await request(BASE).post(url)
			expect([401, 403]).toContain(res.status)
		})
	})
})
