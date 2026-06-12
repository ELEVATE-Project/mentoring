const request = require('supertest')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const schemas = require('./schemas/report-mapping.schemas.json')

describe('report-mapping endpoints generated from api-doc.yaml', () => {
	describe('POST /mentoring/v1/report-mapping/create', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/report-mapping/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			req = req
				.send({
					report_code: 'string',
					role_title: 'string',
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_report-mapping_create']
			expect(res.body).toMatchSchema(schema)
		})

		test('should return 400/422 for invalid body', async () => {
			const url = `/mentoring/v1/report-mapping/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			req = req.send({}).set('Content-Type', 'application/json')
			const res = await req
			expect([400, 422]).toContain(res.status)
		})
	})

	describe('GET /mentoring/v1/report-mapping/read', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/report-mapping/read?code=total_number_of_sessions_attended`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_report-mapping_read']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('POST /mentoring/v1/report-mapping/update', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/report-mapping/update?id=16`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			req = req
				.send({
					report_code: 'string',
					role_title: 'string',
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_report-mapping_update']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('DELETE /mentoring/v1/report-mapping/delete', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/report-mapping/delete?id=16`
			let req = request(BASE).delete(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['DELETE_mentoring_v1_report-mapping_delete']
			expect(res.body).toMatchSchema(schema)
		})
	})
})
