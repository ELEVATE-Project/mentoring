const request = require('supertest')
const Ajv = require('ajv')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'
const ajv = new Ajv({ strict: false })
const commonHelper = require('@commonTests')
let userDetails = null
const schemas = require('./schemas/entity.schemas.json')

beforeAll(async () => {
	console.log('setting up global variables....')
	userDetails = await commonHelper.logIn()
	/*
   let profileCreate = await request(BASE).post('/mentoring/v1/profile/create').set('x-auth-token', userDetails.token).send({
      designation: ['beo', 'deo', 'testt'],
      area_of_expertise: ['educational_leadership', 'sqaa'],
      education_qualification: 'MBA',
      tags: ['Experienced', 'Technical'],
      visibility: 'visible',
      organisation_ids: [1],
      external_session_visibility: 'CURRENT',
      external_mentor_visibility: 'ALL',
    })

    console.log(profileCreate.body, 'profileCreatebody')
  */
})

describe('entity endpoints generated from api-doc.yaml', () => {
	describe('POST /mentoring/v1/entity/create', () => {
		test('should return 201', async () => {
			const url = `/mentoring/v1/entity/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					value: 'en',
					label: 'English',
					entity_type_id: 1,
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['POST_/mentoring/v1/entity/create']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/entity/create`
			const res = await request(BASE).post(url)
			expect([401, 403]).toContain(res.status)
		})
	})

	describe('PUT /mentoring/v1/entity/update/{id}', () => {
		test('should return 202', async () => {
			const url = `/mentoring/v1/entity/update/1`
			let req = request(BASE).put(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					value: 'english',
					label: 'English',
					status: 'ACTIVE',
					entity_type_id: 1,
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['PUT_/mentoring/v1/entity/update/{id}']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/entity/update/1`
			const res = await request(BASE).put(url)
			expect([401, 403]).toContain(res.status)
		})
	})

	describe('POST /mentoring/v1/entity/read/{id}', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/entity/read/string`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['POST_/mentoring/v1/entity/read/{id}']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/entity/read/string`
			const res = await request(BASE).post(url)
			expect([401, 403]).toContain(res.status)
		})
	})

	describe('DELETE /mentoring/v1/entity/delete/{id}', () => {
		test('should return 202', async () => {
			const url = `/mentoring/v1/entity/delete/string`
			let req = request(BASE).delete(url)
			req = req.set('x-auth-token', 'string')
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['DELETE_/mentoring/v1/entity/delete/{id}']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/entity/delete/string`
			const res = await request(BASE).delete(url)
			expect([401, 403]).toContain(res.status)
		})
	})
})
