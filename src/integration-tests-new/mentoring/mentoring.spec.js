const request = require('supertest')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'

const schemas = require('./schemas/mentoring.schemas.json')

describe('mentoring endpoints generated from api-doc.yaml', () => {
	describe('GET /mentoring/health', () => {
		test('should return 200', async () => {
			const url = `/mentoring/health`
			let req = request(BASE).get(url)
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['GET_mentoring_health']
			expect(res.body).toMatchSchema(schema)
		})
	})
})
