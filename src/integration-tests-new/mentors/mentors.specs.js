const request = require('supertest')
const Ajv = require('ajv')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'
const ajv = new Ajv({ strict: false })
const commonHelper = require('@commonTests')
let userDetails = null
const schemas = require('./schemas/mentors.schemas.json')

beforeAll(async () => {
	console.log('setting up global variables....')
	userDetails = await commonHelper.mentorLogIn()

	require('fs').writeFileSync('./debug.log', JSON.stringify(userDetails, null, 2), 'utf-8')
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

describe('mentors endpoints generated from api-doc.yaml', () => {
	/*
  describe('GET /mentoring/v1/mentors/details/{mentorId}', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/mentors/details/62a820225ff93f30cfe5f990`;
      let req = request(BASE).get(url);
      req = req.set('x-auth-token', "string");
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['GET_/mentoring/v1/mentors/details/{mentorId}'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

    test('should return 401/403 when unauthorized', async () => {
      const url = `/mentoring/v1/mentors/details/62a820225ff93f30cfe5f990`;
      const res = await request(BASE).get(url);
      expect([401,403]).toContain(res.status);
    });

    
  });

  describe('GET /mentoring/v1/mentors/reports', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/mentors/reports?filterType=QUARTERLY`;
      let req = request(BASE).get(url);
      req = req.set('x-auth-token', "string");
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['GET_/mentoring/v1/mentors/reports'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

    test('should return 401/403 when unauthorized', async () => {
      const url = `/mentoring/v1/mentors/reports?filterType=QUARTERLY`;
      const res = await request(BASE).get(url);
      expect([401,403]).toContain(res.status);
    });

    
  });

  describe('GET /mentoring/v1/mentors/upcomingSessions/{mentorId}', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/mentors/upcomingSessions/62a820225ff93f30cfe5f990?page=1&limit=2&search=jhon`;
      let req = request(BASE).get(url);
      req = req.set('x-auth-token', "string");
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['GET_/mentoring/v1/mentors/upcomingSessions/{mentorId}'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

    test('should return 401/403 when unauthorized', async () => {
      const url = `/mentoring/v1/mentors/upcomingSessions/62a820225ff93f30cfe5f990?page=1&limit=2&search=jhon`;
      const res = await request(BASE).get(url);
      expect([401,403]).toContain(res.status);
    });

    
  });

  describe('GET /mentoring/v1/mentors/share/{mentorId}', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/mentors/share/21`;
      let req = request(BASE).get(url);
      req = req.set('x-auth-token', "string");
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['GET_/mentoring/v1/mentors/share/{mentorId}'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

    test('should return 401/403 when unauthorized', async () => {
      const url = `/mentoring/v1/mentors/share/21`;
      const res = await request(BASE).get(url);
      expect([401,403]).toContain(res.status);
    });

    
  });

  */

	describe('GET /mentoring/v1/mentors/list', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/mentors/list?page=1&limit=10&search=&directory=true&search_on=`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', userDetails.token)
			const res = await req

			require('fs').writeFileSync(
				'./debug_list.log',
				JSON.stringify({ body: res.body, status: res.status, token: userDetails.token }, null, 2),
				'utf-8'
			)

			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)

			// validate response schema
			const schema = schemas['GET_/mentoring/v1/mentors/list']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/mentors/list?page=1&limit=100&search=&directory=true&search_on=`
			const res = await request(BASE).get(url)
			expect([401, 403]).toContain(res.status)
		})
	})

	describe('GET /mentoring/v1/mentors/createdSessions', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/mentors/createdSessions?page=1&limit=100&search=`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', userDetails.token)
			const res = await req

			expect(res.status).toBeGreaterThanOrEqual(200)
			require('fs').writeFileSync(
				'./debug_createdSessions.log',
				JSON.stringify({ body: res.body, name: 'saish', token: userDetails.token }, null, 2),
				'utf-8'
			)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['GET_/mentoring/v1/mentors/createdSessions']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/mentors/createdSessions?page=1&limit=100&search=`
			const res = await request(BASE).get(url)
			expect([401, 403]).toContain(res.status)
		})
	})
})
