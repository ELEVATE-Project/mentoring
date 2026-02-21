jest.setTimeout(30000)
const request = require('supertest')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const commonHelper = require('@commonTests')

const schemas = require('./schemas/default-rule.schemas.json')

let adminDetails = null
let testEntityTypeValue = null
let createdRuleId = null

beforeAll(async () => {
	adminDetails = await commonHelper.adminLogin()

	// Create a unique entity type for this test run
	//make it unique using random alphabets not numbers
	testEntityTypeValue = 'entityTypeForRule' + Math.random().toString(36).substring(2).replace(/[0-9]/g, '')
	const createEntityTypeRes = await request(BASE)
		.post('/mentoring/v1/entity-type/create')
		.set('x-auth-token', adminDetails.token)
		.send({
			value: testEntityTypeValue,
			label: 'Test Entity Type for Rules',
			data_type: 'STRING',
			model_names: ['UserExtension'],
			required: true, // As per your requirement
			allow_filtering: true,
		})
	expect(createEntityTypeRes.status).toBe(201)
})

describe('default-rule endpoints generated from api-doc.yaml', () => {
	describe('POST /mentoring/v1/default-rule/create', () => {
		test('should return 201', async () => {
			const url = `/mentoring/v1/default-rule/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', adminDetails.token)
			req = req
				.send({
					type: 'session',
					target_field: testEntityTypeValue,
					is_target_from_sessions_mentor: true,
					requester_field: testEntityTypeValue,
					operator: 'equals',
					requester_roles: ['session_manager'],
					requester_roles_config: {
						exclude: true,
					},
				})
				.set('Content-Type', 'application/json')

			const res = await req
			expect(res.status).toBe(201)
			createdRuleId = res.body.result.id // Save the ID for update/delete tests
			expect(res.status).toBe(201)
			// validate response schema
			expect(res.body).toMatchSchema(schemas['POST_mentoring_v1_default-rule_create'])
		})

		test('should return 400/422 for invalid body', async () => {
			const url = `/mentoring/v1/default-rule/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', adminDetails.token)
			req = req.send({}).set('Content-Type', 'application/json')
			const res = await req
			expect([400, 422]).toContain(res.status)
		})
	})

	describe('GET /mentoring/v1/default-rule/read', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/default-rule/read`
			const res = await request(BASE).get(url).set('x-auth-token', adminDetails.token)
			expect(res.status).toBe(200)
			// validate response schema
			expect(res.body).toMatchSchema(schemas['GET_mentoring_v1_default-rule_read'])
		})
	})

	describe('PATCH /mentoring/v1/default-rule/update/{id}', () => {
		test('should return 200 on successful update', async () => {
			// Step 1: Create a unique entity type for the update test
			const entityTypeForUpdate =
				'entityTypeForUpdate' + Math.random().toString(36).substring(2).replace(/[0-9]/g, '')
			const createEntityTypeRes = await request(BASE)
				.post('/mentoring/v1/entity-type/create')
				.set('x-auth-token', adminDetails.token)
				.send({
					value: entityTypeForUpdate,
					label: 'Test Entity Type for Rule Update',
					data_type: 'STRING',
					model_names: ['UserExtension'],
					required: true,
					allow_filtering: true,
				})
			expect(createEntityTypeRes.status).toBe(201)

			// Step 2: Create a default rule to be updated
			const createRuleRes = await request(BASE)
				.post('/mentoring/v1/default-rule/create')
				.set('x-auth-token', adminDetails.token)
				.send({
					type: 'session',
					target_field: entityTypeForUpdate,
					is_target_from_sessions_mentor: true,
					requester_field: entityTypeForUpdate,
					operator: 'equals',
					requester_roles: ['session_manager'],
					requester_roles_config: { exclude: true },
				})
			expect(createRuleRes.status).toBe(201)
			const ruleIdToUpdate = createRuleRes.body.result.id

			// Step 3: Update the created rule
			const url = `/mentoring/v1/default-rule/update/${ruleIdToUpdate}`
			let req = request(BASE).patch(url).set('x-auth-token', adminDetails.token)
			req = req
				.send({
					type: 'session',
					target_field: entityTypeForUpdate.toLocaleLowerCase(),
					requester_field: entityTypeForUpdate.toLocaleLowerCase(),
					// Using a different operator for update
					operator: 'notEquals',
					requester_roles_config: { exclude: false },
					is_target_from_sessions_mentor: true,
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBe(202)
			// validate response schema
			expect(res.body).toMatchSchema(schemas['PATCH_mentoring_v1_default-rule_update_id'])
		})
	})

	describe('DELETE /mentoring/v1/default-rule/delete/{id}', () => {
		test('should return 200 on successful deletion', async () => {
			// Step 1: Create a unique entity type for the delete test
			const entityTypeForDelete =
				'entityTypeForDelete' + Math.random().toString(36).substring(2).replace(/[0-9]/g, '')
			const createEntityTypeRes = await request(BASE)
				.post('/mentoring/v1/entity-type/create')
				.set('x-auth-token', adminDetails.token)
				.send({
					value: entityTypeForDelete,
					label: 'Test Entity Type for Rule Deletion',
					data_type: 'STRING',
					model_names: ['UserExtension'],
					required: true,
					allow_filtering: true,
				})
			expect(createEntityTypeRes.status).toBe(201)

			// Step 2: Create a default rule to be deleted
			const createRuleRes = await request(BASE)
				.post('/mentoring/v1/default-rule/create')
				.set('x-auth-token', adminDetails.token)
				.send({
					type: 'session',
					target_field: entityTypeForDelete,
					is_target_from_sessions_mentor: true,
					requester_field: entityTypeForDelete,
					operator: 'equals',
					requester_roles: ['session_manager'],
					requester_roles_config: { exclude: true },
				})
			expect(createRuleRes.status).toBe(201)
			const ruleIdToDelete = createRuleRes.body.result.id

			// Step 3: Delete the created rule
			const url = `/mentoring/v1/default-rule/delete/${ruleIdToDelete}`
			const res = await request(BASE).delete(url).set('x-auth-token', adminDetails.token)
			expect(res.status).toBe(202)
			// validate response schema
			expect(res.body).toMatchSchema(schemas['DELETE_mentoring_v1_default-rule_delete_id'])
		})
	})
})
