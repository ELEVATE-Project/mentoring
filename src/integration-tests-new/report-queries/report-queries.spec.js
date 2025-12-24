const request = require('supertest')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'

const schemas = require('./schemas/report-queries.schemas.json')

describe('report-queries endpoints generated from api-doc.yaml', () => {
	describe('POST /mentoring/v1/report-queries/create', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/report-queries/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_report-queries_create']
			expect(res.body).toMatchSchema(schema)
		})

		test('should return 400/422 for invalid body', async () => {
			const url = `/mentoring/v1/report-queries/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			req = req.send({}).set('Content-Type', 'application/json')
			const res = await req
			expect([400, 422]).toContain(res.status)
		})
	})

	describe('GET /mentoring/v1/report-queries/read', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/report-queries/read?code=string`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_report-queries_read']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('POST /mentoring/v1/report-queries/update', () => {
		test('should return 201', async () => {
			const url = `/mentoring/v1/report-queries/update?code=string`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			const res = await req
			expect(res.status).toBe(201)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_report-queries_update']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('DELETE /mentoring/v1/report-queries/delete', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/report-queries/delete?id=1`
			let req = request(BASE).delete(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['DELETE_mentoring_v1_report-queries_delete']
			expect(res.body).toMatchSchema(schema)
		})
	})
})
