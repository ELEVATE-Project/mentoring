const request = require('supertest')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'

const schemas = require('./schemas/question-set.schemas.json')

describe('question-set endpoints generated from api-doc.yaml', () => {
	describe('POST /mentoring/v1/question-set/create', () => {
		test('should return 201', async () => {
			const url = `/mentoring/v1/question-set/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					questions: [1],
					code: 'feedback',
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBe(201)
			// validate response schema
			const schema = schemas['POST_/mentoring/v1/question-set/create']
			expect(res.body).toMatchSchema(schema)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/question-set/create`
			const res = await request(BASE).post(url)
			expect([401, 403]).toContain(res.status)
		})
	})

	describe('PATCH /mentoring/v1/question-set/update/{QuestionSetId}', () => {
		test('should return 202', async () => {
			const url = `/mentoring/v1/question-set/update/1`
			let req = request(BASE).patch(url)
			req = req.set('x-auth-token', 'string')
			req = req
				.send({
					questions: [1],
					code: 'UpdatedFeedbackCode',
				})
				.set('Content-Type', 'application/json')
			const res = await req
			expect(res.status).toBe(202)
			// validate response schema
			const schema = schemas['PATCH_/mentoring/v1/question-set/update/{QuestionSetId}']
			expect(res.body).toMatchSchema(schema)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/question-set/update/1`
			const res = await request(BASE).patch(url)
			expect([401, 403]).toContain(res.status)
		})
	})

	describe('POST /mentoring/v1/question-set/read/{QuestionSetId}', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/question-set/read/1`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', 'string')
			const res = await req
			expect(res.status).toBe(200)
			// validate response schema
			const schema = schemas['POST_/mentoring/v1/question-set/read/{QuestionSetId}']
			expect(res.body).toMatchSchema(schema)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/question-set/read/1`
			const res = await request(BASE).post(url)
			expect([401, 403]).toContain(res.status)
		})
	})
})
