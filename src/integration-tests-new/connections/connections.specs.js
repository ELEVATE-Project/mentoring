const request = require('supertest')
const Ajv = require('ajv')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'
const ajv = new Ajv({ strict: false })
const commonHelper = require('@commonTests')
let userDetails = null

const schemas = require('./schemas/connections.schemas.json')

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

describe('connections endpoints generated from api-doc.yaml', () => {
	/*
  describe('POST /mentoring/v1/connections/initiate', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/connections/initiate`;
      let req = request(BASE).post(url);
      req = req.send({
  "user_id": "string",
  "message": "string"
}).set('Content-Type', 'application/json');
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['POST_mentoring_v1_connections_initiate'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

  });

  describe('GET /mentoring/v1/connections/pending', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/connections/pending?page=1&limit=1`;
      let req = request(BASE).get(url);
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['GET_mentoring_v1_connections_pending'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

  });

  describe('POST /mentoring/v1/connections/getInfo', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/connections/getInfo`;
      let req = request(BASE).post(url);
      req = req.send({
  "user_id": "string"
}).set('Content-Type', 'application/json');
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['POST_mentoring_v1_connections_getInfo'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

  });

  describe('POST /mentoring/v1/connections/reject', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/connections/reject`;
      let req = request(BASE).post(url);
      req = req.send({
  "user_id": "string"
}).set('Content-Type', 'application/json');
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['POST_mentoring_v1_connections_reject'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

  });

  describe('POST /mentoring/v1/connections/accept', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/connections/accept`;
      let req = request(BASE).post(url);
      req = req.send({
  "user_id": "string"
}).set('Content-Type', 'application/json');
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['POST_mentoring_v1_connections_accept'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

  });

*/
	describe('GET /mentoring/v1/connections/list', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/connections/list?page=1&limit=1`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', userDetails.token)
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_connections_list']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})
})
