jest.setTimeout(100000)
const request = require('supertest')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const commonHelper = require('@commonTests')
const schemas = require('./schemas/mentees.schemas.json')
let userDetails = null

beforeAll(async () => {
	console.log('setting up global variables....')
	adminDetails = await commonHelper.adminLogin()
	let adminToken = adminDetails.token
	userDetails = await commonHelper.logIn()

	let profileCreate = await request(BASE)
		.post('/mentoring/v1/profile/create')
		.set('x-auth-token', userDetails.token)
		.send({
			designation: ['beo', 'deo', 'testt'],
			area_of_expertise: ['educational_leadership', 'sqaa'],
			education_qualification: 'MBA',
			tags: ['Experienced', 'Technical'],
			visibility: 'visible',
			organisation_ids: [1],
			external_session_visibility: 'CURRENT',
			external_mentor_visibility: 'ALL',
		})

	await request(BASE).post('/mentoring/v1/admin/triggerViewRebuild').set('x-auth-token', adminToken)
})

describe('mentees endpoints generated from api-doc.yaml', () => {
	// describe('GET /mentoring/v1/mentees/sessions', () => {
	//   test('should return 200', async () => {
	//     const url = `/mentoring/v1/mentees/sessions?page=1&limit=2`;
	//     let req = request(BASE).get(url);
	//     req = req.set('x-auth-token', "string");
	//     const res = await req;
	//     expect(res.status).toBe(200);
	//     expect(res.body).toMatchSchema(schemas['GET_/mentoring/v1/mentees/sessions']);
	//   });

	//   test('should return 401/403 when unauthorized', async () => {
	//     const url = `/mentoring/v1/mentees/sessions?page=1&limit=2`;
	//     const res = await request(BASE).get(url);
	//     expect([401,403]).toContain(res.status);
	//   });

	// });

	// describe('GET /mentoring/v1/mentees/joinSession/{sessionId}', () => {
	//   test('should return 200', async () => {
	//     const url = `/mentoring/v1/mentees/joinSession/62832531a05cbd57b273aebb`;
	//     let req = request(BASE).get(url);
	//     req = req.set('x-auth-token', "string");
	//     const res = await req;
	//     expect(res.status).toBe(200);
	//     expect(res.body).toMatchSchema(schemas['GET_/mentoring/v1/mentees/joinSession/{sessionId}']);
	//   });

	//   test('should return 401/403 when unauthorized', async () => {
	//     const url = `/mentoring/v1/mentees/joinSession/62832531a05cbd57b273aebb`;
	//     const res = await request(BASE).get(url);
	//     expect([401,403]).toContain(res.status);
	//   });

	// });

	// describe('GET /mentoring/v1/mentees/reports', () => {
	//   test('should return 200', async () => {
	//     const url = `/mentoring/v1/mentees/reports?filterType=QUARTERLY`;
	//     let req = request(BASE).get(url);
	//     req = req.set('x-auth-token', "string");
	//     const res = await req;
	//     expect(res.status).toBe(200);
	//     expect(res.body).toMatchSchema(schemas['GET_/mentoring/v1/mentees/reports']);
	//   });

	//   test('should return 401/403 when unauthorized', async () => {
	//     const url = `/mentoring/v1/mentees/reports?filterType=QUARTERLY`;
	//     const res = await request(BASE).get(url);
	//     expect([401,403]).toContain(res.status);
	//   });

	// });

	describe('GET /mentoring/v1/mentees/homeFeed', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/mentees/homeFeed`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', userDetails.token)
			const res = await req
			expect(res.status).toBe(200)
			expect(res.body).toMatchSchema(schemas['GET_/mentoring/v1/mentees/homeFeed'])
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/mentees/homeFeed`
			const res = await request(BASE).get(url)
			expect([401, 403]).toContain(res.status)
		})
	})

	describe('GET /mentoring/v1/mentees/list', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/mentees/list?page=1&limit=5&search=&connected_mentees=true&mentorId=${userDetails.id}`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', userDetails.token)
			const res = await req
			expect(res.status).toBe(200)
			expect(res.body).toMatchSchema(schemas['GET_/mentoring/v1/mentees/list'])
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/mentees/list?page=1&limit=5&search=&connected_mentees=true&mentorId=${userDetails.id}`
			const res = await request(BASE).get(url)
			expect([401, 403]).toContain(res.status)
		})
	})
})
