jest.setTimeout(60000) // Set default timeout to 30 seconds
const request = require('supertest')
const Ajv = require('ajv')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'
const ajv = new Ajv({ strict: false })
const commonHelper = require('@commonTests')
let menteeDetails = null // This user will make the request
let mentorDetails = null // This user will be the requestee
const schemas = require('./schemas/requestSessions.schemas.json')

beforeAll(async () => {
	console.log('setting up global variables....')
	// Log in both a mentee and a mentor for the test
	menteeDetails = await commonHelper.logIn()
	mentorDetails = await commonHelper.mentorLogIn()
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

describe('Session Request Lifecycle', () => {
	let createdRequestSessionId

	describe('Create Session Request', () => {
		test('POST /mentoring/v1/requestSessions/create - should return 201 on successful creation', async () => {
			const url = `/mentoring/v1/requestSessions/create` // Removed query parameters

			// Create dynamic start and end dates
			const now = new Date()
			const startDate = new Date(now)
			startDate.setDate(now.getDate() + 10) // 5 days in the future
			const startDateTimestamp = Math.floor(startDate.getTime() / 1000)

			const endDate = new Date(startDate)
			endDate.setHours(startDate.getHours() + 1) // 1 hour duration
			const endDateTimestamp = Math.floor(endDate.getTime() / 1000)

			let req = request(BASE).post(url)
			req = req
				.set('x-auth-token', menteeDetails.token) // Use mentee's token
				.set('org-id', menteeDetails.organizations[0]) // Correctly access the org ID string
				.set('timezone', 'Asia/Calcutta') // Add timezone header
				.send({
					title: 'test request session via jest',
					start_date: startDateTimestamp,
					end_date: endDateTimestamp,
					agenda: 'Dynamic agenda to teach chess basics',
					requestee_id: mentorDetails.userId.toString(), // Use mentor's ID as the requestee
					time_zone: 'Asia/Calcutta',
				})

			const res = await req

			expect(res.status).toBe(201)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_requestSessions_create']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
			createdRequestSessionId = res.body.result.id // Capture the created request ID
			expect(createdRequestSessionId).toBeDefined()
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/requestSessions/create`
			const res = await request(BASE).post(url)
			expect([401, 403]).toContain(res.status)
		})

		test('should return 400/422 for invalid body', async () => {
			const url = `/mentoring/v1/requestSessions/create`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', menteeDetails.token)
			req = req.send({}).set('Content-Type', 'application/json')
			const res = await req
			expect([400, 422]).toContain(res.status)
		})
	})

	describe('Accept Session Request', () => {
		test('POST /mentoring/v1/requestSessions/accept - should return 201 when mentor accepts', async () => {
			const url = `/mentoring/v1/requestSessions/accept?SkipValidation=true`
			let req = request(BASE).post(url)
			req = req
				.set('x-auth-token', mentorDetails.token) // Use mentor's token to accept
				.set('org-id', mentorDetails.organizations[0].id.toString()) // Correctly access the org ID string
				.set('timezone', 'Asia/Calcutta') // Add timezone header
				.send({
					request_session_id: createdRequestSessionId.toString(),
				})

			const res = await req
			expect(res.status).toBe(201)
			// validate response schema
			const schema = schemas['POST_mentoring_v1_requestSessions_accept']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/requestSessions/accept`
			const res = await request(BASE).post(url)
			expect([401, 403]).toContain(res.status)
		})
	})
})

describe('Session Request Rejection Lifecycle', () => {
	let createdRequestSessionId

	// This test creates a new session request that will be used in the rejection test below.
	// It's good practice to isolate test lifecycles (e.g., accept vs. reject).
	test('POST /mentoring/v1/requestSessions/create - should create a new request to be rejected', async () => {
		const url = `/mentoring/v1/requestSessions/create`

		const now = new Date()
		const startDate = new Date(now)
		startDate.setDate(now.getDate() + 15) // 15 days in the future to avoid conflicts
		const startDateTimestamp = Math.floor(startDate.getTime() / 1000)

		const endDate = new Date(startDate)
		endDate.setHours(startDate.getHours() + 1)
		const endDateTimestamp = Math.floor(endDate.getTime() / 1000)

		const res = await request(BASE)
			.post(url)
			.set('x-auth-token', menteeDetails.token)
			.set('org-id', menteeDetails.organizations[0])
			.set('timezone', 'Asia/Calcutta')
			.send({
				title: 'test request session for rejection via jest',
				start_date: startDateTimestamp,
				end_date: endDateTimestamp,
				agenda: 'Dynamic agenda to test rejection flow',
				requestee_id: mentorDetails.userId.toString(),
				time_zone: 'Asia/Calcutta',
			})

		expect(res.status).toBe(201)
		createdRequestSessionId = res.body.result.id
		expect(createdRequestSessionId).toBeDefined()
	})

	describe('Reject Session Request', () => {
		test('POST /mentoring/v1/requestSessions/reject - should return 201 when mentor rejects', async () => {
			const url = `/mentoring/v1/requestSessions/reject`
			const res = await request(BASE)
				.post(url)
				.set('x-auth-token', mentorDetails.token) // Mentor's token to reject
				.set('org-id', mentorDetails.organizations[0].id.toString())
				.send({
					request_session_id: createdRequestSessionId.toString(),
					reject_reason: 'Scheduling conflict.',
				})

			expect(res.status).toBe(201)

			const schema = schemas['POST_mentoring_v1_requestSessions_reject']
			const validate = ajv.compile(schema)
			const valid = validate(res.body)
			if (!valid) {
				console.error('Schema validation errors:', validate.errors)
			}
			expect(valid).toBe(true)
		})
	})
})

describe('Standalone requestSessions endpoints', () => {
	describe('GET /mentoring/v1/requestSessions/list', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/requestSessions/list?pageNo=1&pageSize=5`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', menteeDetails.token)
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
