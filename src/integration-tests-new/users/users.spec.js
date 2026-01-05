const request = require('supertest')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'

const schemas = require('./schemas/users.schemas.json')

describe('users endpoints generated from api-doc.yaml', () => {
	describe('GET /mentoring/v1/users/pendingFeedbacks', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/users/pendingFeedbacks`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', 'string')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_users_pendingFeedbacks']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('GET /mentoring/v1/users/list?type={userType}&page={page}&limit={limit}&search={search}', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/users/list?type=mentor&page=1&limit=2&search=jhon`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', 'string')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_users_list_type_userType_page_page_limit_limit_search_search']
			expect(res.body).toMatchSchema(schema)
		})
	})
})
