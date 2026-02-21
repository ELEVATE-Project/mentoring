jest.setTimeout(100000)
const request = require('supertest')
const fs = require('fs')
const path = require('path')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const commonHelper = require('@commonTests')
let mentorDetails = null
const schemas = require('./schemas/profile.schemas.json')

beforeAll(async () => {
	mentorDetails = await commonHelper.logIn()
})

describe('profile endpoints generated from api-doc.yaml', () => {
	describe('POST /mentoring/v1/profile/update', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/profile/update`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', mentorDetails.token)
			req = req
				.send({
					designation: ['Principal'],
					area_of_expertise: ['educational_leadership'],
					experience: '5',
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_profile_update']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('GET /mentoring/v1/profile/filterList?entity_types={entity_types}', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/profile/filterList?entity_types=designation`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', mentorDetails.token)
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_profile_filterList_entity_types_entity_types']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('GET /mentoring/v1/profile/details', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/profile/details/${mentorDetails.userId}`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', mentorDetails.token)
			const res = await req
			expect(res.status).toBe(200)

			// validate response schema
			const schema = schemas['GET_mentoring_v1_profile_details']
			expect(res.body).toMatchSchema(schema)
		})
	})
})
