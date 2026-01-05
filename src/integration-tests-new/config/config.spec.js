const request = require('supertest')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'

const schemas = require('./schemas/config.schemas.json')

describe('config endpoints generated from api-doc.yaml', () => {
	describe('GET /mentoring/v1/config/get', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/config/get`
			let req = request(BASE).get(url)
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_config_get']
			expect(res.body).toMatchSchema(schema)
		})
	})
})
