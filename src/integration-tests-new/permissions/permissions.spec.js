const request = require('supertest')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const schemas = require('./schemas/permissions.schemas.json')

describe('permissions endpoints generated from api-doc.yaml', () => {
	describe('POST /mentoring/v1/permissions/create', () => {
		test('should return 201', async () => {
			const url = `/mentoring/v1/permissions/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					code: 'string',
					module: 'string',
					request_type: ['string'],
					api_path: 'string',
					status: 'string',
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBe(201)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_permissions_create']
			expect(res.body).toMatchSchema(schema)
		})

		test('should return 400/422 for invalid body', async () => {
			const url = `/mentoring/v1/permissions/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req.send({}).set('Content-Type', 'application/json')
			const res = await req
			expect([400, 422]).toContain(res.status)
		})
	})

	describe('POST /mentoring/v1/permissions/update/{id}', () => {
		test('should return 201', async () => {
			const url = `/mentoring/v1/permissions/update/{id}`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					code: 'string',
					module: 'string',
					request_type: ['string'],
					api_path: 'string',
					status: 'string',
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBe(201)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_permissions_update_id']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('DELETE /mentoring/v1/permissions/delete/{id}', () => {
		test('should return 202', async () => {
			const url = `/mentoring/v1/permissions/delete/{id}`
			let req = request(BASE).delete(url)
			req = req.set('x-auth-token', 'string')
			const res = await req
			expect(res.status).toBe(202)
			// validate response schema
			const schema = schemas['DELETE_mentoring_v1_permissions_delete_id']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('GET /mentoring/v1/permissions/list?page={page}&limit={limit}&search={search}', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/permissions/list?page=1&limit=2&search=John`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', 'string')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_permissions_list_page_page_limit_limit_search_search']
			expect(res.body).toMatchSchema(schema)
		})
	})
})
