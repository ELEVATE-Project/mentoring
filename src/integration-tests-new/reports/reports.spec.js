const request = require('supertest')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'

const schemas = require('./schemas/reports.schemas.json')

describe('reports endpoints generated from api-doc.yaml', () => {
	describe('POST /mentoring/v1/reports/create', () => {
		test('should return 201', async () => {
			const url = `/mentoring/v1/reports/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			req = req
				.send({
					code: 'string',
					title: 'string',
					description: 'string',
					report_type_title: 'string',
					created_at: 'string',
					updated_at: 'string',
					config: {
						columns: [
							{
								key: 'string',
								label: 'string',
								filter: true,
								sort: true,
								search: true,
								filterType: 'string',
								isEntityType: true,
								isMultipleFilter: true,
								dataType: 'string',
								defaultValues: [
									{
										label: 'string',
										value: 'string',
									},
								],
							},
						],
					},
					organization_id: 'string',
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBe(201)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_reports_create']
			expect(res.body).toMatchSchema(schema)
		})

		test('should return 400/422 for invalid body', async () => {
			const url = `/mentoring/v1/reports/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			req = req.send({}).set('Content-Type', 'application/json')
			const res = await req
			expect([400, 422]).toContain(res.status)
		})
	})

	describe('GET /mentoring/v1/reports/read', () => {
		test('should return 201', async () => {
			const url = `/mentoring/v1/reports/read?id=1`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			const res = await req
			expect(res.status).toBe(201)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_reports_read']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('POST /mentoring/v1/reports/update/{id}', () => {
		test('should return 202', async () => {
			const url = `/mentoring/v1/reports/update/string`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			req = req
				.send({
					code: 'string',
					title: 'string',
					description: 'string',
					report_type_title: 'string',
					config: 'string',
					organization_id: 1,
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBe(202)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_reports_update_id']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('DELETE /mentoring/v1/reports/delete', () => {
		test('should return 202', async () => {
			const url = `/mentoring/v1/reports/delete?id=1`
			let req = request(BASE).delete(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			const res = await req
			expect(res.status).toBe(202)
			// validate response schema
			const schema = schemas['DELETE_mentoring_v1_reports_delete']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('POST /mentoring/v1/reports/reportData', () => {
		test('should return 201', async () => {
			const url = `/mentoring/v1/reports/reportData?report_code=report_code&report_role=role&start_date=1735756200&end_date=1738348199&session_type=All&download_csv=string&pageNo=1&Limit=1&organization=string&group_by=string&entities_value=string&sort_column=string&sort_value=string`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			req = req
				.send({
					filters: {
						mentor_name: ['string'],
					},
					search: {
						mentor_name: ['string'],
					},
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBe(201)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_reports_reportData']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('GET /mentoring/v1/reports/filterList', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/reports/filterList?filter_type=session&report_filter=true`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_reports_filterList']
			expect(res.body).toMatchSchema(schema)
		})
	})
})
