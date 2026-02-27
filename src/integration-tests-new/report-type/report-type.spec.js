const request = require('supertest')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const schemas = require('./schemas/report-type.schemas.json')

describe('report-type endpoints generated from api-doc.yaml', () => {
	describe('POST /mentoring/v1/report-type/create', () => {
		test('should return 201', async () => {
			const url = `/mentoring/v1/report-type/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			req = req
				.send({
					title: 'string',
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBe(201)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_report-type_create']
			expect(res.body).toMatchSchema(schema)
		})

		test('should return 400/422 for invalid body', async () => {
			const url = `/mentoring/v1/report-type/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			req = req.send({}).set('Content-Type', 'application/json')
			const res = await req
			expect([400, 422]).toContain(res.status)
		})
	})

	describe('GET /mentoring/v1/report-type/read', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/report-type/read?title=random_title`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', TOKEN)
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_report-type_read']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('POST /mentoring/v1/report-type/update', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/report-type/update?id=1`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', TOKEN)
			req = req
				.send({
					title: 'string',
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_report-type_update']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('DELETE /mentoring/v1/report-type/delete', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/report-type/delete?id=1`
			let req = request(BASE).delete(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['DELETE_mentoring_v1_report-type_delete']
			expect(res.body).toMatchSchema(schema)
		})
	})
})
