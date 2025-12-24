const request = require('supertest')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'
const schemas = require('./schemas/admin.schemas.json')

describe('admin endpoints generated from api-doc.yaml', () => {
	describe('DELETE /mentoring/v1/admin/userDelete', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/admin/userDelete`
			let req = request(BASE).delete(url)
			req = req.set('x-auth-token', 'string')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['DELETE_mentoring_v1_admin_userDelete']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('GET /mentoring/v1/admin/triggerViewRebuild', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/admin/triggerViewRebuild`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', 'string')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_admin_triggerViewRebuild']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('GET /mentoring/v1/admin/triggerViewRebuildInternal', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/admin/triggerViewRebuildInternal`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', 'string')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_admin_triggerViewRebuildInternal']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('GET /mentoring/v1/admin/triggerPeriodicViewRefresh', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/admin/triggerPeriodicViewRefresh`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', 'string')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_admin_triggerPeriodicViewRefresh']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('GET /mentoring/v1/admin/triggerPeriodicViewRefreshInternal', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/admin/triggerPeriodicViewRefreshInternal`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', 'string')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_admin_triggerPeriodicViewRefreshInternal']
			expect(res.body).toMatchSchema(schema)
		})
	})
})
