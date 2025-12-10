jest.setTimeout(100000)
const request = require('supertest')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'
const commonHelper = require('@commonTests')
let adminDetails = null

const schemas = require('./schemas/connections.schemas.json')

beforeAll(async () => {
	adminDetails = await commonHelper.adminLogin()
})

describe('connections endpoints generated from api-doc.yaml', () => {
	describe('POST /mentoring/v1/connections/initiate', () => {
		test('should return 200', async () => {
			const menteeDetails = await commonHelper.logIn()
			const mentorDetails = await commonHelper.mentorLogIn()

			const url = `/mentoring/v1/connections/initiate`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', menteeDetails.token) // Mentee initiates
			req = req
				.send({
					user_id: mentorDetails.userId.toString(), // With mentor
					message: 'Hi, I would like to connect with you.',
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBe(201)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_connections_initiate']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('POST /mentoring/v1/connections/accept', () => {
		test('should return 200', async () => {
			const menteeDetails = await commonHelper.logIn()
			const mentorDetails = await commonHelper.mentorLogIn()
			// Step 1: Mentee initiates a connection with Mentor
			const initiateRes = await request(BASE)
				.post('/mentoring/v1/connections/initiate')
				.set('x-auth-token', menteeDetails.token)
				.send({
					user_id: mentorDetails.userId.toString(),
					message: 'Hi, please accept my connection request.',
				})
			expect(initiateRes.status).toBe(201)

			// Step 2: Mentor accepts the connection from Mentee
			const url = `/mentoring/v1/connections/accept`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', mentorDetails.token) // Mentor accepts
			req = req
				.send({
					user_id: menteeDetails.userId.toString(), // From mentee
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBe(201)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_connections_accept']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('POST /mentoring/v1/connections/reject', () => {
		test('should return 200', async () => {
			const menteeDetails = await commonHelper.logIn()
			const mentorDetails = await commonHelper.mentorLogIn()
			// Step 1: Mentee initiates a connection with Mentor
			const initiateRes = await request(BASE)
				.post('/mentoring/v1/connections/initiate')
				.set('x-auth-token', menteeDetails.token)
				.send({
					user_id: mentorDetails.userId.toString(),
					message: 'Hi, I am sending a request to be rejected.',
				})
			expect(initiateRes.status).toBe(201)

			// Step 2: Mentor rejects the connection from Mentee
			const url = `/mentoring/v1/connections/reject`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', mentorDetails.token) // Mentor rejects
			req = req
				.send({
					user_id: menteeDetails.userId.toString(), // From mentee
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBe(201)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_connections_reject']
			expect(res.body).toMatchSchema(schema)
		})
	})
})
