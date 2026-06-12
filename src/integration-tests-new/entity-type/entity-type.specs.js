jest.setTimeout(100000)
const request = require('supertest')
const Ajv = require('ajv')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'
const ajv = new Ajv({ strict: false })
const commonHelper = require('@commonTests')
let menteeDetails = null // This user will make the request
let mentorDetails = null // This user will be the requestee

const schemas = require('./schemas/entity-type.schemas.json')

beforeAll(async () => {
	console.log('setting up global variables....')
	// Log in both a mentee and a mentor for the test
	menteeDetails = await commonHelper.logIn()
	mentorDetails = await commonHelper.mentorLogIn()
})

describe('entity-type endpoints generated from api-doc.yaml', () => {
	describe('POST /mentoring/v1/entity-type/create', () => {
		test('should return 201', async () => {
			const url = `/mentoring/v1/entity-type/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', menteeDetails.token)
			req = req.set('org-id', menteeDetails.organizations[0].id.toString())
			req = req.set('timezone', 'Asia/Calcutta')
			req = req
				.send({
					value: 'string',
					label: 'String',
					allow_filtering: true,
					data_type: 'string',
					model_names: ['UserExtension'],
					required: true,
					status: 'string',
					type: 'string',
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(400) // Allow for 2xx and 3xx statuses
			// validate response schema
			const schema = schemas['POST_mentoring_v1_entity-type_create']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})

	describe('GET /mentoring/v1/entity-type/read', () => {
		// Note: The endpoint name suggests GET, but the implementation requires POST.
		test('should return 200 on success', async () => {
			const url = `/mentoring/v1/entity-type/read`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', mentorDetails.token)
			req = req.set('org-id', mentorDetails.organizations[0].id.toString())
			req = req.set('timezone', 'Asia/Calcutta')
			// This endpoint expects a body with the values to read, similar to the QA curl command.
			req = req.send({ value: ['string', 'designation'] })
			const res = await req
			expect(res.status).toBe(200)
			require('fs').writeFileSync('./entityTypeResponse.json', JSON.stringify(res.body, null, 2))
			// validate response schema
			const schema = schemas['GET_mentoring_v1_entity-type_read']
			if (!schema) throw new Error('Schema not found for GET_mentoring_v1_entity-type_read')
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})

	describe('POST /mentoring/v1/entity-type/update/{id}', () => {
		test('should return 200 on success', async () => {
			const url = `/mentoring/v1/entity-type/update/1` // Use a real or placeholder ID
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', menteeDetails.token)
			req = req.set('org-id', menteeDetails.organizations[0].id.toString())
			req = req.set('timezone', 'Asia/Calcutta')
			req = req
				.send({
					value: 'string',
					label: 'string',
					status: 'string',
					type: 'string',
					data_type: 'number',
					model_names: ['Session'],
					allow_filtering: true,
					required: true,
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			if (!schemas['POST_mentoring_v1_entity-type_update_id'])
				throw new Error('Schema not found for POST_mentoring_v1_entity-type_update_id')
			const schema = schemas['POST_mentoring_v1_entity-type_update_id']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})

	describe('DELETE /mentoring/v1/entity-type/delete/{id}', () => {
		test('should return 200 on success', async () => {
			const url = `/mentoring/v1/entity-type/delete/1` // Use a real or placeholder ID
			let req = request(BASE).delete(url)
			req = req.set('x-auth-token', menteeDetails.token)
			req = req.set('org-id', menteeDetails.organizations[0].id.toString())
			req = req.set('timezone', 'Asia/Calcutta')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			if (!schemas['DELETE_mentoring_v1_entity-type_delete_id'])
				throw new Error('Schema not found for DELETE_mentoring_v1_entity-type_delete_id')
			const schema = schemas['DELETE_mentoring_v1_entity-type_delete_id']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})
})
