const request = require('supertest')
const Ajv = require('ajv')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'
const ajv = new Ajv({ strict: false })
const commonHelper = require('@commonTests')
let userDetails = null
const schemas = require('./schemas/profile.schemas.json')

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

describe('profile endpoints generated from api-doc.yaml', () => {
	/*
  describe('POST /mentoring/v1/profile/create', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/profile/create`;
      let req = request(BASE).post(url);
      req = req.set('x-auth-token', "string");
      req = req.send({
  "designation": "string",
  "area_of_expertise": [
    "string"
  ],
  "education_qualification": [
    "string"
  ],
  "experience": "string",
  "stats": {
    "sessions_attended": 1,
    "students_mentored": 1
  },
  "tags": [
    "string"
  ],
  "configs": {
    "notification": true,
    "visibility": "string"
  },
  "visibility": "string",
  "organisation_ids": [
    1
  ],
  "external_session_visibility": "string",
  "external_mentor_visibility": "string"
}).set('Content-Type', 'application/json');
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['POST_mentoring_v1_profile_create'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

  });

  describe('POST /mentoring/v1/profile/update', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/profile/update`;
      let req = request(BASE).post(url);
      req = req.set('x-auth-token', "string");
      req = req.send({
  "designation": "string",
  "area_of_expertise": [
    "string"
  ],
  "education_qualification": [
    "string"
  ],
  "experience": "string",
  "tags": [
    "string"
  ],
  "configs": {
    "notification": true,
    "visibility": "string"
  }
}).set('Content-Type', 'application/json');
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['POST_mentoring_v1_profile_update'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

  });
*/
	describe('GET /mentoring/v1/profile/filterList?entity_types={entity_types}', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/profile/filterList?entity_types=designation`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', userDetails.token)
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
			// validate response schema
			const schema = schemas['GET_mentoring_v1_profile_filterList_entity_types_entity_types']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})

	/*
  describe('GET /mentoring/v1/profile/details', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/profile/details`;
      let req = request(BASE).get(url);
      req = req.set('x-auth-token', "bearer {{token}}");
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['GET_mentoring_v1_profile_details'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

  });
*/
})
