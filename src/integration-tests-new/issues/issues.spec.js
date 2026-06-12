const request = require('supertest')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const schemas = require('./schemas/issues.schemas.json')

describe('issues endpoints generated from api-doc.yaml', () => {
	describe('POST /mentoring/v1/issues/create', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/issues/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					descriptaion: 'string',
					meta_data: {
						request_type: 'string',
						browserName: 'string',
						browserVersion: 'string',
					},
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_issues_create']
			expect(res.body).toMatchSchema(schema)
		})
	})
})
