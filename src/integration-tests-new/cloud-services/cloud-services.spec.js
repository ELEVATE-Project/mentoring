const request = require('supertest')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'

const schemas = require('./schemas/cloud-services.schemas.json')

describe('cloud-services endpoints generated from api-doc.yaml', () => {
	describe('GET /mentoring/v1/cloud-services/getSignedUrl', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/cloud-services/getSignedUrl`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', 'string')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_cloud-services_getSignedUrl']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('GET /mentoring/v1/cloud-services/getDownloadableUrl', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/cloud-services/getDownloadableUrl`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', 'string')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_cloud-services_getDownloadableUrl']
			expect(res.body).toMatchSchema(schema)
		})
	})
})
