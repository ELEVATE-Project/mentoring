const request = require('supertest')
const Ajv = require('ajv')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'
const ajv = new Ajv({ strict: false })

const schemas = require('./schemas/form.schemas.json')

describe('form endpoints generated from api-doc.yaml', () => {
	describe('POST /mentoring/v1/form/create', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/form/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					type: 'session',
					sub_type: 'createSessions',
					data: {
						template_name: 'defaultTemplate',
						fields: {
							controls: [
								{
									name: 'title',
									label: 'title',
									value: '',
									class: 'ion-margin',
									type: 'text',
									position: 'floating',
									validators: {
										required: true,
										min_length: 5,
									},
								},
								{
									name: 'categories',
									label: 'Select categories',
									value: '',
									class: 'ion-margin',
									type: 'chip',
									position: '',
									disabled: false,
									show_select_all: true,
									validators: {
										required: true,
									},
								},
								{
									name: 'ages',
									label: 'Select age',
									value: '',
									class: 'ion-margin',
									type: 'chip',
									position: '',
									disabled: false,
									show_select_all: true,
									validators: {
										required: true,
									},
								},
							],
						},
					},
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['POST_/mentoring/v1/form/create']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/form/create`
			const res = await request(BASE).post(url)
			expect([401, 403]).toContain(res.status)
		})
	})

	describe('PUT /mentoring/v1/form/update/{formId}', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/form/update/1`
			let req = request(BASE).put(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					type: 'session',
					sub_type: 'createSessionsNew',
					data: {
						template_name: 'Test',
						fields: {
							controls: [
								{
									name: 'title',
									label: 'title',
									value: '',
									class: 'ion-margin',
									type: 'text',
									position: 'floating',
									validators: {
										required: true,
										min_length: 5,
									},
								},
								{
									name: 'categories',
									label: 'Select categories',
									value: '',
									class: 'ion-margin',
									type: 'chip',
									position: '',
									disabled: false,
									show_select_all: true,
									validators: {
										required: true,
									},
								},
								{
									name: 'ages',
									label: 'Select age',
									value: '',
									class: 'ion-margin',
									type: 'chip',
									position: '',
									disabled: false,
									show_select_all: true,
									validators: {
										required: true,
									},
								},
							],
						},
					},
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['PUT_/mentoring/v1/form/update/{formId}']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/form/update/1`
			const res = await request(BASE).put(url)
			expect([401, 403]).toContain(res.status)
		})
	})

	describe('POST /mentoring/v1/form/read/{formId}', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/form/read/1`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					type: 'session',
					sub_type: 'createSessionsNew',
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['POST_/mentoring/v1/form/read/{formId}']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/form/read/1`
			const res = await request(BASE).post(url)
			expect([401, 403]).toContain(res.status)
		})
	})
})
