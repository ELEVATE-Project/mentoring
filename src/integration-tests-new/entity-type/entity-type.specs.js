jest.setTimeout(100000)
const request = require('supertest')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const commonHelper = require('@commonTests')
let menteeDetails = null // This user will make the request
let mentorDetails = null // This user will be the requestee
let adminDetails = null // Admin user if needed

const schemas = require('./schemas/entity-type.schemas.json')

beforeAll(async () => {
	console.log('setting up global variables....')
	// Log in both a mentee and a mentor for the test
	menteeDetails = await commonHelper.logIn()
	mentorDetails = await commonHelper.mentorLogIn()
	adminDetails = await commonHelper.adminLogin()
})

describe('entity-type endpoints generated from api-doc.yaml', () => {
	describe('POST /mentoring/v1/entity-type/create', () => {
		test('should return 201', async () => {
			let value = 'string' + Math.random().toString(36).substring(2).replace(/[0-9]/g, '')

			console.log('Creating entity type with value:', value)
			const url = `/mentoring/v1/entity-type/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', adminDetails.token)
			req = req.set('org-id', adminDetails.organizations[0].id.toString())
			req = req.set('timezone', 'Asia/Calcutta')
			req = req
				.send({
					value: value, // need unique value so concatenate with more characters which are alphabets and not numbers
					label: 'String',
					allow_filtering: true,
					data_type: 'STRING',
					model_names: ['UserExtension'],
					required: true,
					status: 'string',
					type: 'string',
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBe(201)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_entity-type_create']
			expect(res.body).toMatchSchema(schema)
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
			// validate response schema
			const schema = schemas['GET_mentoring_v1_entity-type_read']
			if (!schema) throw new Error('Schema not found for GET_mentoring_v1_entity-type_read')
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('POST /mentoring/v1/entity-type/update/{id}', () => {
		test('should return 200 on success', async () => {
			//const url = `/mentoring/v1/entity-type/update/1` // Use a real or placeholder ID
			// First, create an entity type to update
			const value = 'updateTestEntity' + Math.random().toString(36).substring(2).replace(/[0-9]/g, '')
			const createRes = await request(BASE)
				.post('/mentoring/v1/entity-type/create')
				.set('x-auth-token', adminDetails.token)
				.set('org-id', adminDetails.organizations[0].id.toString())
				.send({
					value: value,
					label: 'Test Label',
					data_type: 'STRING',
					model_names: ['UserExtension'],
					status: 'ACTIVE',
				})

			expect(createRes.status).toBe(201)
			const entityTypeId = createRes.body.result.id

			// Now, update the created entity type
			const url = `/mentoring/v1/entity-type/update/${entityTypeId}`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', adminDetails.token)
			req = req.set('org-id', adminDetails.organizations[0].id.toString())
			req = req.set('timezone', 'Asia/Calcutta')

			// Update payload
			req = req
				.send({
					value: value,
					label: 'string',
					status: 'INACTIVE',
					type: 'string',
					data_type: 'STRING',
					model_names: ['Session'],
					allow_filtering: true,
					required: true,
				})
				.set('Content-Type', 'application/json')
			const res = await req
			//change to greater than equal to 202 exact
			expect(res.status).toBe(202)

			// validate response schema
			if (!schemas['POST_mentoring_v1_entity-type_update_id'])
				throw new Error('Schema not found for POST_mentoring_v1_entity-type_update_id')
			const schema = schemas['POST_mentoring_v1_entity-type_update_id']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('DELETE /mentoring/v1/entity-type/delete/{id}', () => {
		test('should return 200 on success', async () => {
			//const url = `/mentoring/v1/entity-type/delete/1` // Use a real or placeholder ID
			// First, create an entity type to delete
			const value = 'deleteTestEntity' + Math.random().toString(36).substring(2).replace(/[0-9]/g, '')
			const createRes = await request(BASE)
				.post('/mentoring/v1/entity-type/create')
				.set('x-auth-token', adminDetails.token)
				.set('org-id', adminDetails.organizations[0].id.toString())
				.send({
					value: value,
					label: 'Test Label for Deletion',
					data_type: 'STRING',
					model_names: ['UserExtension'],
					status: 'ACTIVE',
				})

			expect(createRes.status).toBe(201)
			const entityTypeId = createRes.body.result.id

			// Now, delete the created entity type
			const url = `/mentoring/v1/entity-type/delete/${entityTypeId}`
			let req = request(BASE).delete(url)
			req = req.set('x-auth-token', adminDetails.token)
			req = req.set('org-id', adminDetails.organizations[0].id.toString())
			req = req.set('timezone', 'Asia/Calcutta')
			const res = await req
			expect(res.status).toBe(202)
			// validate response schema
			if (!schemas['DELETE_mentoring_v1_entity-type_delete_id'])
				throw new Error('Schema not found for DELETE_mentoring_v1_entity-type_delete_id')
			const schema = schemas['DELETE_mentoring_v1_entity-type_delete_id']
			expect(res.body).toMatchSchema(schema)
		})
	})
})
