jest.setTimeout(100000)
const request = require('supertest')
const Ajv = require('ajv')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'
const ajv = new Ajv({ strict: false })
const commonHelper = require('@commonTests')
let userDetails = null

const schemas = require('./schemas/sessions.schemas.json')

beforeAll(async () => {
	console.log('setting up global variables....')
	userDetails = await commonHelper.mentorLogIn()

	let profileCreate = await request(BASE)
		.post('/mentoring/v1/profile/update')
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

	console.log(profileCreate.body, 'profileCreatebody')

	require('fs').writeFileSync('./debug1.log', JSON.stringify(userDetails, null, 2), 'utf-8')

	userDetails.token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoyNDIzLCJuYW1lIjoiTmV2aWwiLCJzZXNzaW9uX2lkIjoxMjg2Mywib3JnYW5pemF0aW9uX2lkcyI6WyIxIl0sIm9yZ2FuaXphdGlvbl9jb2RlcyI6WyJkZWZhdWx0X2NvZGUiXSwidGVuYW50X2NvZGUiOiJkZWZhdWx0Iiwib3JnYW5pemF0aW9ucyI6W3siaWQiOjEsIm5hbWUiOiJEZWZhdWx0IE9yZ2FuaXphdGlvbiIsImNvZGUiOiJkZWZhdWx0X2NvZGUiLCJkZXNjcmlwdGlvbiI6IkRlZmF1bHQgIFNMIE9yZ2FuaXNhdGlvbiIsInN0YXR1cyI6IkFDVElWRSIsInJlbGF0ZWRfb3JncyI6bnVsbCwidGVuYW50X2NvZGUiOiJkZWZhdWx0IiwibWV0YSI6bnVsbCwiY3JlYXRlZF9ieSI6bnVsbCwidXBkYXRlZF9ieSI6MSwicm9sZXMiOlt7ImlkIjo0LCJ0aXRsZSI6Im1lbnRvciIsImxhYmVsIjoibWVudG9yIiwidXNlcl90eXBlIjowLCJzdGF0dXMiOiJBQ1RJVkUiLCJvcmdhbml6YXRpb25faWQiOjEsInZpc2liaWxpdHkiOiJQVUJMSUMiLCJ0ZW5hbnRfY29kZSI6ImRlZmF1bHQiLCJ0cmFuc2xhdGlvbnMiOm51bGx9XX1dfSwiaWF0IjoxNzY0MjczODc1LCJleHAiOjE3NjQ1MzMwNzV9.UFOg-eMFrsnuabro1Q5sYd4a0h-TZ1jkT3ts4VN9a1o`
})

describe('sessions endpoints generated from api-doc.yaml', () => {
	describe('Session Details Lifecycle', () => {
		let createdSessionId

		beforeAll(async () => {
			// Create a session to be used in the tests
			const now = new Date()
			const startDate = new Date(now)
			startDate.setDate(now.getDate() + 3)
			const startDateTimestamp = Math.floor(startDate.getTime() / 1000)

			const endDate = new Date(startDate)
			endDate.setHours(startDate.getHours() + 1)
			const endDateTimestamp = Math.floor(endDate.getTime() / 1000)

			const createUrl = `/mentoring/v1/sessions/update`
			const createRes = await request(BASE).post(createUrl).set('x-auth-token', userDetails.token).send({
				title: 'test nov 27',
				description: 'desc',
				type: 'PUBLIC',
				mentees: [],
				start_date: startDateTimestamp,
				end_date: endDateTimestamp,
				recommended_for: [],
				categories: [],
				medium: [],
				time_zone: 'Asia/Calcutta',
				mentor_id: '2423',
			})

			// Log the response to help with debugging
			console.log('Create session response status:', createRes.status)
			console.log('Create session response body:', JSON.stringify(createRes.body, null, 2))

			// Assuming 201 is the success status for creation
			expect(createRes.status).toBe(201)
			createdSessionId = createRes.body.result.id
			expect(createdSessionId).toBeDefined()
		})

		afterAll(async () => {
			// Clean up the created session
			if (createdSessionId) {
				const deleteUrl = `/mentoring/v1/sessions/update/${createdSessionId}`
				// We don't need to assert the result of cleanup, but it's good practice to ensure it runs
				await request(BASE).delete(deleteUrl).set('x-auth-token', userDetails.token)
			}
		})

		test('GET /mentoring/v1/sessions/details/{sessionId} - should return 200 on success', async () => {
			const url = `/mentoring/v1/sessions/details/${createdSessionId}`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', userDetails.token)
			const res = await req
			expect(res.status).toBeGreaterThanOrEqual(200)
			expect(res.status).toBeLessThan(300)
		})

		test('GET /mentoring/v1/sessions/details/{sessionId} - should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/sessions/details/${createdSessionId}`
			const res = await request(BASE).get(url)
			expect([401, 403]).toContain(res.status)
		})
	})

	/*
  describe('GET /mentoring/v1/sessions/list', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/sessions/list?page=1&limit=2&status=PUBLISHED, COMPLETED&search=John&recommended_for=string`;
      let req = request(BASE).get(url);
      req = req.set('x-auth-token', userDetails.token);
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['GET_/mentoring/v1/sessions/list'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

    test('should return 401/403 when unauthorized', async () => {
      const url = `/mentoring/v1/sessions/list?page=1&limit=2&status=PUBLISHED, COMPLETED&search=John&recommended_for=string`;
      const res = await request(BASE).get(url);
      expect([401,403]).toContain(res.status);
    });

    
  });

  describe('GET /mentoring/v1/sessions/share/{sessionId}', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/sessions/share/1`;
      let req = request(BASE).get(url);
      req = req.set('x-auth-token', userDetails.token);
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['GET_/mentoring/v1/sessions/share/{sessionId}'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

    test('should return 401/403 when unauthorized', async () => {
      const url = `/mentoring/v1/sessions/share/1`;
      const res = await request(BASE).get(url);
      expect([401,403]).toContain(res.status);
    });

    
  });

  describe('POST /mentoring/v1/sessions/enroll/{sessionId}', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/sessions/enroll/1`;
      let req = request(BASE).post(url);
      req = req.set('x-auth-token', userDetails.token);
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['POST_/mentoring/v1/sessions/enroll/{sessionId}'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

    test('should return 401/403 when unauthorized', async () => {
      const url = `/mentoring/v1/sessions/enroll/1`;
      const res = await request(BASE).post(url);
      expect([401,403]).toContain(res.status);
    });

    
  });

  describe('POST /mentoring/v1/sessions/unenroll/{sessionId}', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/sessions/unenroll/1`;
      let req = request(BASE).post(url);
      req = req.set('x-auth-token', userDetails.token);
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['POST_/mentoring/v1/sessions/unenroll/{sessionId}'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

    test('should return 401/403 when unauthorized', async () => {
      const url = `/mentoring/v1/sessions/unenroll/1`;
      const res = await request(BASE).post(url);
      expect([401,403]).toContain(res.status);
    });

    
  });

  describe('GET /mentoring/v1/sessions/start/{sessionId}', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/sessions/start/1`;
      let req = request(BASE).get(url);
      req = req.set('x-auth-token', userDetails.token);
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['GET_/mentoring/v1/sessions/start/{sessionId}'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

    test('should return 401/403 when unauthorized', async () => {
      const url = `/mentoring/v1/sessions/start/1`;
      const res = await request(BASE).get(url);
      expect([401,403]).toContain(res.status);
    });

    
  });

  describe('POST /mentoring/v1/sessions/update', () => {
    test('should return 201', async () => {
      const url = `/mentoring/v1/sessions/update`;
      let req = request(BASE).post(url);
      req = req.set('x-auth-token', userDetails.token);
      req = req.send({
        "title": "Leadership session by Adam",
        "description": "Leadership session desc",
        "start_date": "1695210731",
        "end_date": "1695214329",
        "mentee_feedback_question_set": "MENTEE_QS1",
        "mentor_feedback_question_set": "MENTOR_QS2",
        "recommended_for": [
          "deo"
        ],
        "categories": [
          "educational_leadership"
        ],
        "medium": [
          "en"
        ],
        "image": [
          "users/1232s2133sdd1-12e2dasd3123.png"
        ]
      }).set('Content-Type', 'application/json');
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['POST_/mentoring/v1/sessions/update'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

    test('should return 401/403 when unauthorized', async () => {
      const url = `/mentoring/v1/sessions/update`;
      const res = await request(BASE).post(url);
      expect([401,403]).toContain(res.status);
    });

    
  });

  describe('DELETE /mentoring/v1/sessions/update/{sessionId}', () => {
    test('should return 202', async () => {
      const url = `/mentoring/v1/sessions/update/1`;
      let req = request(BASE).delete(url);
      req = req.set('x-auth-token', userDetails.token);
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['DELETE_/mentoring/v1/sessions/update/{sessionId}'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

    test('should return 401/403 when unauthorized', async () => {
      const url = `/mentoring/v1/sessions/update/1`;
      const res = await request(BASE).delete(url);
      expect([401,403]).toContain(res.status);
    });

    
  });

  describe('POST /mentoring/v1/sessions/update/{sessionId}', () => {
    test('should return 202', async () => {
      const url = `/mentoring/v1/sessions/update/1`;
      let req = request(BASE).post(url);
      req = req.set('x-auth-token', userDetails.token);
      req = req.send({
        "title": "Leadership session by Adam",
        "description": "Leadership session desc",
        "start_date": "1695210731",
        "end_date": "1695214329",
        "mentee_feedback_question_set": "MENTEE_QS1",
        "mentor_feedback_question_set": "MENTOR_QS2",
        "recommended_for": [
          "deo"
        ],
        "categories": [
          "educational_leadership"
        ],
        "medium": [
          "en"
        ],
        "image": [
          "users/1232s2133sdd1-12e2dasd3123.png"
        ]
      }).set('Content-Type', 'application/json');
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['POST_/mentoring/v1/sessions/update/{sessionId}'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

    test('should return 401/403 when unauthorized', async () => {
      const url = `/mentoring/v1/sessions/update/1`;
      const res = await request(BASE).post(url);
      expect([401,403]).toContain(res.status);
    });

    
  });

  describe('GET /mentoring/v1/sessions/getRecording/{sessionId}', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/sessions/getRecording/1`;
      let req = request(BASE).get(url);
      req = req.set('x-auth-token', userDetails.token);
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['GET_/mentoring/v1/sessions/getRecording/{sessionId}'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

    test('should return 401/403 when unauthorized', async () => {
      const url = `/mentoring/v1/sessions/getRecording/1`;
      const res = await request(BASE).get(url);
      expect([401,403]).toContain(res.status);
    });

    
  });

  describe('PATCH /mentoring/v1/sessions/completed/{sessionId}', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/sessions/completed/1`;
      let req = request(BASE).patch(url);
      req = req.set('x-auth-token', userDetails.token);
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['PATCH_/mentoring/v1/sessions/completed/{sessionId}'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

    test('should return 401/403 when unauthorized', async () => {
      const url = `/mentoring/v1/sessions/completed/1`;
      const res = await request(BASE).patch(url);
      expect([401,403]).toContain(res.status);
    });

    
  });

  describe('PATCH /mentoring/v1/sessions/updateRecordingUrl/{internalSessionId}', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/sessions/updateRecordingUrl/1`;
      let req = request(BASE).patch(url);
      req = req.set('x-auth-token', userDetails.token);
      const res = await req;
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      // validate response schema
      const schema = schemas['PATCH_/mentoring/v1/sessions/updateRecordingUrl/{internalSessionId}'];
      const validate = ajv.compile(schema);
      const valid = validate(res.body);
      if (!valid) {
        console.error("Schema validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });

    test('should return 401/403 when unauthorized', async () => {
      const url = `/mentoring/v1/sessions/updateRecordingUrl/1`;
      const res = await request(BASE).patch(url);
      expect([401,403]).toContain(res.status);
    });

    
  });
*/
})
