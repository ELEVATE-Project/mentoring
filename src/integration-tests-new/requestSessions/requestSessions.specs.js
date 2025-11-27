const request = require('supertest')
const Ajv = require('ajv')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'
const ajv = new Ajv({ strict: false })
const commonHelper = require('@commonTests')
let userDetails = null
const schemas = require('./schemas/requestSessions.schemas.json')

beforeAll(async () => {
	console.log('setting up global variables....')
	userDetails = await commonHelper.logIn()

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

describe('requestSessions endpoints generated from api-doc.yaml', () => {
	/*
  describe('POST /mentoring/v1/requestSessions/create', () => {
    test('should return 201', async () => {
      const url = `/mentoring/v1/requestSessions/create?pageNo=1&pageSize=5`;
      let req = request(BASE).post(url);
      req = req.set('x-auth-token', "test-token");
      req = req.send({
  "requestee_id": "string",
  "title": "string",
  "agenda": "string",
  "start_date": "string",
  "end_date": "string"
}).set('Content-Type', 'application/json');
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['POST_mentoring_v1_requestSessions_create'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

    test('should return 401/403 when unauthorized', async () => {
      const url = `/mentoring/v1/requestSessions/create?pageNo=1&pageSize=5`;
      const res = await request(BASE).post(url);
      expect([401,403]).toContain(res.status);
    });

    test('should return 400/422 for invalid body', async () => {
      const url = `/mentoring/v1/requestSessions/create?pageNo=1&pageSize=5`;
      let req = request(BASE).post(url);
      req = req.set('x-auth-token', "test-token");
      req = req.send({}).set('Content-Type', 'application/json');
      const res = await req;
      expect([400,422]).toContain(res.status);
    });

  });

  */
	describe('GET /mentoring/v1/requestSessions/list', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/requestSessions/list?pageNo=1&pageSize=5`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', userDetails.token)
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_requestSessions_list']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/requestSessions/list?pageNo=1&pageSize=5`
			const res = await request(BASE).get(url)
			expect([401, 403]).toContain(res.status)
		})
	})

	/*
  describe('GET /mentoring/v1/requestSessions/getDetails', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/requestSessions/getDetails?request_session_id=string`;
      let req = request(BASE).get(url);
      req = req.set('x-auth-token', "test-token");
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['GET_mentoring_v1_requestSessions_getDetails'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

    test('should return 401/403 when unauthorized', async () => {
      const url = `/mentoring/v1/requestSessions/getDetails?request_session_id=string`;
      const res = await request(BASE).get(url);
      expect([401,403]).toContain(res.status);
    });

  });

  describe('GET /mentoring/v1/requestSessions/userAvailability', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/requestSessions/userAvailability?pageNo=string&pageSize=string&status=string&start_date=string&end_date=string`;
      let req = request(BASE).get(url);
      req = req.set('x-auth-token', "test-token");
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['GET_mentoring_v1_requestSessions_userAvailability'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

    test('should return 401/403 when unauthorized', async () => {
      const url = `/mentoring/v1/requestSessions/userAvailability?pageNo=string&pageSize=string&status=string&start_date=string&end_date=string`;
      const res = await request(BASE).get(url);
      expect([401,403]).toContain(res.status);
    });

  });

  describe('POST /mentoring/v1/requestSessions/accept', () => {
    test('should return 201', async () => {
      const url = `/mentoring/v1/requestSessions/accept`;
      let req = request(BASE).post(url);
      req = req.set('x-auth-token', "test-token");
      req = req.send({
  "request_session_id": "string"
}).set('Content-Type', 'application/json');
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['POST_mentoring_v1_requestSessions_accept'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

    test('should return 401/403 when unauthorized', async () => {
      const url = `/mentoring/v1/requestSessions/accept`;
      const res = await request(BASE).post(url);
      expect([401,403]).toContain(res.status);
    });

    test('should return 400/422 for invalid body', async () => {
      const url = `/mentoring/v1/requestSessions/accept`;
      let req = request(BASE).post(url);
      req = req.set('x-auth-token', "test-token");
      req = req.send({}).set('Content-Type', 'application/json');
      const res = await req;
      expect([400,422]).toContain(res.status);
    });

  });

  describe('POST /mentoring/v1/requestSessions/reject', () => {
    test('should return 201', async () => {
      const url = `/mentoring/v1/requestSessions/reject`;
      let req = request(BASE).post(url);
      req = req.set('x-auth-token', "test-token");
      req = req.send({
  "request_session_id": "string"
}).set('Content-Type', 'application/json');
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['POST_mentoring_v1_requestSessions_reject'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

    test('should return 401/403 when unauthorized', async () => {
      const url = `/mentoring/v1/requestSessions/reject`;
      const res = await request(BASE).post(url);
      expect([401,403]).toContain(res.status);
    });

    test('should return 400/422 for invalid body', async () => {
      const url = `/mentoring/v1/requestSessions/reject`;
      let req = request(BASE).post(url);
      req = req.set('x-auth-token', "test-token");
      req = req.send({}).set('Content-Type', 'application/json');
      const res = await req;
      expect([400,422]).toContain(res.status);
    });

  });

  */
})
