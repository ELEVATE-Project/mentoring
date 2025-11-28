const request = require('supertest')
const Ajv = require('ajv')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'
const ajv = new Ajv({ strict: false })

const schemas = require('./schemas/org-admin.schemas.json')

describe('org-admin endpoints generated from api-doc.yaml', () => {
	describe('POST /mentoring/v1/org-admin/roleChange', () => {
		test('should return 201', async () => {
			const url = `/mentoring/v1/org-admin/roleChange`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					user_id: 'string',
					current_roles: ['string'],
					new_roles: ['string'],
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_org-admin_roleChange']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})

	describe('POST /mentoring/v1/org-admin/inheritEntityType', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/org-admin/inheritEntityType`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					entity_type_value: 'string',
					target_entity_type_label: 'string',
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_org-admin_inheritEntityType']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})

	describe('GET /mentoring/v1/org-admin/getOrgPolicies', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/org-admin/getOrgPolicies`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', 'string')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_org-admin_getOrgPolicies']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})

	describe('POST /mentoring/v1/org-admin/updateRelatedOrgs', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/org-admin/updateRelatedOrgs`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					responseCode: 'string',
					message: 'string',
					result: ['string'],
					meta: {
						correlation: 'string',
						meetingPlatform: 'string',
					},
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_org-admin_updateRelatedOrgs']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})

	describe('POST /mentoring/v1/org-admin/setOrgPolicies', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/org-admin/setOrgPolicies`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					session_visibility_policy: 'string',
					mentor_visibility_policy: 'string',
					external_session_visibility_policy: 'string',
					external_mentor_visibility_policy: 'string',
					allow_mentor_override: true,
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_org-admin_setOrgPolicies']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})

	describe('POST /mentoring/v1/org-admin/uploadSampleCSV', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/org-admin/uploadSampleCSV`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req.send('string').set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_org-admin_uploadSampleCSV']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})

	describe('POST /mentoring/v1/org-admin/updateTheme', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/org-admin/updateTheme`
			let req = request(BASE).post(url)
			req = req.set('X-auth-token', 'bearer {{token}}')
			req = req
				.send({
					primaryColor: '#E74C3C',
					secondaryColor: '#F1C40F',
					backgroundColor: '#FFFFFF',
					textColor: '#34495E',
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_org-admin_updateTheme']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})

	describe('GET /mentoring/v1/org-admin/themeDetails', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/org-admin/themeDetails`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', 'bearer {{token}}')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_org-admin_themeDetails']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})
})
