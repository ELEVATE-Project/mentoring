jest.setTimeout(100000)
const request = require('supertest')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'
const commonHelper = require('@commonTests')
let menteeDetails = null
let mentorDetails = null
let adminDetails = null
const schemas = require('./schemas/entity.schemas.json')

beforeAll(async () => {
	menteeDetails = await commonHelper.logIn()
	mentorDetails = await commonHelper.mentorLogIn()
	adminDetails = await commonHelper.adminLogin()
})

describe('entity endpoints generated from api-doc.yaml', () => {
	describe('POST /mentoring/v1/entity/create', () => {
		test('should return 201', async () => {
			// First, create an entity-type to associate the entity with
			let entityValue = 'newEntityType' + Math.random().toString(36).substring(2).replace(/[0-9]/g, '')
			const entityTypeRes = await request(BASE)
				.post('/mentoring/v1/entity-type/create')
				.set('x-auth-token', adminDetails.token)
				.set('org-id', adminDetails.organizations[0].id.toString())
				.send({
					value: entityValue,
					label: 'Test Entity Type',
					data_type: 'STRING',
					model_names: ['UserExtension'],
					status: 'ACTIVE',
				})
			expect(entityTypeRes.status).toBe(201)
			const entityTypeId = entityTypeRes.body.result.id

			const url = `/mentoring/v1/entity/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', adminDetails.token)
			req = req.set('org-id', adminDetails.organizations[0].id.toString())
			req = req
				.send({
					value: 'en',
					label: 'English',
					entity_type_id: entityTypeId,
					type: 'SYSTEM',
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBe(201)
			// validate response schema
			const schema = schemas['POST_/mentoring/v1/entity/create']
			expect(res.body).toMatchSchema(schema)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/entity/create`
			const res = await request(BASE).post(url)
			expect([401, 403]).toContain(res.status)
		})
	})

	describe('PUT /mentoring/v1/entity/update/{id}', () => {
		test('should return 202', async () => {
			let value = 'updateEntity' + Math.random().toString(36).substring(2).replace(/[0-9]/g, '')
			// Create entity type
			const entityTypeRes = await request(BASE)
				.post('/mentoring/v1/entity-type/create')
				.set('x-auth-token', adminDetails.token)
				.set('org-id', adminDetails.organizations[0].id.toString())
				.send({
					value: value,
					label: 'Update Test',
					data_type: 'STRING',
					model_names: ['UserExtension'],
					status: 'ACTIVE',
				})

			expect(entityTypeRes.status).toBe(201)
			const entityTypeId = entityTypeRes.body.result.id

			// Create entity
			const entityRes = await request(BASE)
				.post('/mentoring/v1/entity/create')
				.set('x-auth-token', adminDetails.token)
				.set('org-id', adminDetails.organizations[0].id.toString())
				.send({ value: 'initial_val', label: 'Initial Label', entity_type_id: entityTypeId, type: 'SYSTEM' })

			expect(entityRes.status).toBe(201)
			const entityId = entityRes.body.result.id

			const url = `/mentoring/v1/entity/update/${entityId}`
			let req = request(BASE).put(url)
			req = req.set('x-auth-token', adminDetails.token)
			req = req.set('org-id', adminDetails.organizations[0].id.toString())
			req = req
				.send({
					value: 'updatedvalNew',
					label: 'Updated Label',
					status: 'ACTIVE',
					entity_type_id: entityTypeId,
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBe(202)
			// validate response schema
			const schema = schemas['PUT_/mentoring/v1/entity/update/{id}']
			expect(res.body).toMatchSchema(schema)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/entity/update/999` // Some non-existent ID
			const res = await request(BASE).put(url)
			expect([401, 403]).toContain(res.status)
		})
	})

	describe('POST /mentoring/v1/entity/read/{id}', () => {
		test('should return 200', async () => {
			// Create entity type
			let value = 'readEntityType' + Math.random().toString(36).substring(2).replace(/[0-9]/g, '')
			const entityTypeRes = await request(BASE)
				.post('/mentoring/v1/entity-type/create')
				.set('x-auth-token', adminDetails.token)
				.set('org-id', adminDetails.organizations[0].id.toString())
				.send({
					value: value,
					label: 'Read Test',
					data_type: 'STRING',
					model_names: ['UserExtension'],
					status: 'ACTIVE',
				})
			expect(entityTypeRes.status).toBe(201)
			const entityTypeId = entityTypeRes.body.result.id

			// Create entity
			const entityRes = await request(BASE)
				.post('/mentoring/v1/entity/create')
				.set('x-auth-token', adminDetails.token)
				.set('org-id', adminDetails.organizations[0].id.toString())
				.send({ value: 'read_val', label: 'Read Label', entity_type_id: entityTypeId, type: 'SYSTEM' })
			expect(entityRes.status).toBe(201)
			const entityId = entityRes.body.result.id

			const url = `/mentoring/v1/entity/read/${entityId}`
			let req = request(BASE).post(url)
			//change menteedetails to admin token
			req = req.set('x-auth-token', adminDetails.token)
			req = req.set('org-id', adminDetails.organizations[0].id.toString())

			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['POST_/mentoring/v1/entity/read/{id}']
			expect(res.body).toMatchSchema(schema)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/entity/read/string`
			const res = await request(BASE).post(url)
			expect([401, 403]).toContain(res.status)
		})
	})

	describe('DELETE /mentoring/v1/entity/delete/{id}', () => {
		test('should return 202', async () => {
			let value = 'deleteEntityType' + Math.random().toString(36).substring(2).replace(/[0-9]/g, '')
			// Create entity type
			const entityTypeRes = await request(BASE)
				.post('/mentoring/v1/entity-type/create')
				.set('x-auth-token', adminDetails.token)
				.set('org-id', adminDetails.organizations[0].id.toString())
				.send({
					value: value,
					label: 'Delete Test',
					data_type: 'STRING',
					model_names: ['UserExtension'],
					status: 'ACTIVE',
				})
			expect(entityTypeRes.status).toBe(201)
			const entityTypeId = entityTypeRes.body.result.id

			// Create entity
			const entityRes = await request(BASE)
				.post('/mentoring/v1/entity/create')
				.set('x-auth-token', adminDetails.token)
				.set('org-id', adminDetails.organizations[0].id.toString())
				.send({ value: 'delete_val', label: 'Delete Label', entity_type_id: entityTypeId, type: 'SYSTEM' })
			expect(entityRes.status).toBe(201)
			const entityId = entityRes.body.result.id

			const url = `/mentoring/v1/entity/delete/${entityId}`
			let req = request(BASE).delete(url)
			req = req.set('x-auth-token', adminDetails.token)
			const res = await req
			expect(res.status).toBe(202)
			// validate response schema
			const schema = schemas['DELETE_/mentoring/v1/entity/delete/{id}']
			expect(res.body).toMatchSchema(schema)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/entity/delete/999` // Some non-existent ID
			const res = await request(BASE).delete(url)
			expect([401, 403]).toContain(res.status)
		})
	})
})
