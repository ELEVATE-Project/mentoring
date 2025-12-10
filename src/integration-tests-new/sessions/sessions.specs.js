jest.setTimeout(100000)
const request = require('supertest')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const TOKEN = process.env.TEST_BEARER_TOKEN || 'test-token'
const commonHelper = require('@commonTests')

let userDetails = null
let menteeDetails = null

const schemas = require('./schemas/sessions.schemas.json')

beforeAll(async () => {
	userDetails = await commonHelper.mentorLogIn() // Log in a mentor user
	menteeDetails = await commonHelper.logIn() // Log in a second user to act as a mentee (menteeDetails)

	console.log(userDetails)
	console.log(menteeDetails)
	console.log('line 18')
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
				mentor_id: userDetails.userId.toString(),
			})

			// Assuming 201 is the success status for creation
			console.log(createRes, 'create status*')
			expect(createRes.status).toBe(201)
			createdSessionId = createRes.body.result.id
			expect(createdSessionId).toBeDefined()
		})

		afterAll(async () => {
			// Clean up the created session
			if (createdSessionId) {
				const deleteUrl = `/mentoring/v1/sessions/update/${createdSessionId}`
				// We don't need to assert the result of cleanup, but it's good practice to ensure it runs
				//	await request(BASE).delete(deleteUrl).set('x-auth-token', userDetails.token)
			}
		})

		test('GET /mentoring/v1/sessions/details/{sessionId} - should return 200 on success', async () => {
			const url = `/mentoring/v1/sessions/details/${createdSessionId}`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', userDetails.token) // Make the API call
			const res = await req
			expect(res.status).toBe(201)
		})

		test('GET /mentoring/v1/sessions/details/{sessionId} - should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/sessions/details/${createdSessionId}`
			const res = await request(BASE).get(url)
			expect([401, 403]).toContain(res.status)
		})

		test('POST /mentoring/v1/sessions/enroll/{sessionId} - should return 200 on successful enrollment', async () => {
			const url = `/mentoring/v1/sessions/enroll/${createdSessionId}`
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', menteeDetails.token).set('timezone', 'Asia/Calcutta') // Use mentee's token and add timezone // Make the API call
			const res = await req
			expect(res.status).toBe(201)
			// validate response schema
			const schema = schemas['POST_/mentoring/v1/sessions/enroll/{sessionId}']
			expect(res.body).toMatchSchema(schema)
		})

		test('POST /mentoring/v1/sessions/enroll/{sessionId} - should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/sessions/enroll/${createdSessionId}`
			const res = await request(BASE).post(url)
			expect([401, 403]).toContain(res.status)
		})

		test('POST /mentoring/v1/sessions/unenroll/{sessionId} - should return 200 on successful unenrollment', async () => {
			const url = `/mentoring/v1/sessions/unEnroll/${createdSessionId}` // Corrected to camelCase 'unEnroll'
			let req = request(BASE).post(url)
			req = req.set('x-auth-token', menteeDetails.token) // Use mentee's token to unenroll // Make the API call
			const res = await req
			expect(res.status).toBe(202)
			// validate response schema
			const schema = schemas['POST_/mentoring/v1/sessions/unenroll/{sessionId}']
			expect(res.body).toMatchSchema(schema)
		})

		test('POST /mentoring/v1/sessions/unenroll/{sessionId} - should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/sessions/unEnroll/${createdSessionId}` // Corrected to camelCase 'unEnroll'
			const res = await request(BASE).post(url)
			expect([401, 403]).toContain(res.status)
		})
	})

	describe('GET /mentoring/v1/sessions/start/{sessionId}', () => {
		test('should return 200 on successful session start', async () => {
			let mentorDetails = await commonHelper.mentorLogIn()
			// Step 1: Create a session that is scheduled to start now
			const now = new Date()
			const startDate = new Date(now.getTime() - 10 * 1000) // 10 seconds ago
			const startDateTimestamp = Math.floor(startDate.getTime() / 1000)

			const endDate = new Date(startDate)
			endDate.setHours(startDate.getHours() + 1)
			const endDateTimestamp = Math.floor(endDate.getTime() / 1000)

			const createRes = await request(BASE)
				.post('/mentoring/v1/sessions/update')
				.set('x-auth-token', mentorDetails.token)
				.send({
					title: 'Session to be started',
					description: 'desc',
					type: 'PUBLIC',
					start_date: startDateTimestamp,
					end_date: endDateTimestamp,
					time_zone: 'Asia/Calcutta',
					mentor_id: mentorDetails.userId.toString(),
				})

			expect(createRes.status).toBe(201)
			const createdSessionId = createRes.body.result.id

			// Step 2: Start the created session
			const url = `/mentoring/v1/sessions/start/${createdSessionId}`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', mentorDetails.token) // Make the API call
			const res = await req
			expect(res.status).toBe(200)
			const schema = schemas['GET_/mentoring/v1/sessions/start/{sessionId}']
			expect(res.body).toMatchSchema(schema)
		})
	})

	describe('GET /mentoring/v1/mentees/joinSession/{sessionId}', () => {
		test('should return 200 when a mentee joins a started session', async () => {
			const mentorDetails = await commonHelper.mentorLogIn()
			const menteeDetails = await commonHelper.logIn()

			// Step 1: Mentor creates a session scheduled to start now
			const now = new Date()
			const startDate = new Date(now.getTime() - 10 * 1000) // 10 seconds ago
			const startDateTimestamp = Math.floor(startDate.getTime() / 1000)
			const endDate = new Date(startDate)
			endDate.setHours(startDate.getHours() + 1)
			const endDateTimestamp = Math.floor(endDate.getTime() / 1000)

			const createRes = await request(BASE)
				.post('/mentoring/v1/sessions/update')
				.set('x-auth-token', mentorDetails.token) // Mentor's token
				.send({
					title: 'Session to be Joined',
					description: 'desc',
					type: 'PUBLIC',
					start_date: startDateTimestamp,
					end_date: endDateTimestamp,
					time_zone: 'Asia/Calcutta',
					mentor_id: mentorDetails.userId.toString(),
				})
			expect(createRes.status).toBe(201)
			const sessionId = createRes.body.result.id

			// Step 2: Mentor starts the session
			const startRes = await request(BASE)
				.get(`/mentoring/v1/sessions/start/${sessionId}`)
				.set('x-auth-token', mentorDetails.token)

			// Step 3: Mentee enrolls in the session
			const enrollUrl = `/mentoring/v1/sessions/enroll/${sessionId}`
			const enrollRes = await request(BASE)
				.post(enrollUrl)
				.set('x-auth-token', menteeDetails.token)
				.set('timezone', 'Asia/Calcutta')
			expect(enrollRes.status).toBe(201)

			// Step 4: Mentee joins the session
			const url = `/mentoring/v1/mentees/joinSession/${sessionId}`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', menteeDetails.token) // Mentee's token
			req = req.set('org-id', menteeDetails.organizations[0].id.toString())
			req = req.set('timezone', 'Asia/Calcutta')

			const res = await req
			expect(res.status).toBe(200)

			const schema = schemas['GET_/mentoring/v1/mentees/joinSession/{sessionId}']
			expect(res.body).toMatchSchema(schema)
		})

		test('should return 401/403 when trying to join without a token', async () => {
			const mentorDetails = await commonHelper.mentorLogIn()

			// Step 1: Mentor creates a session
			const now = new Date()
			const startDate = new Date(now.getTime() - 10 * 1000) // 10 seconds ago
			const startDateTimestamp = Math.floor(startDate.getTime() / 1000)
			const endDate = new Date(startDate)
			endDate.setHours(startDate.getHours() + 1)
			const endDateTimestamp = Math.floor(endDate.getTime() / 1000)

			const createRes = await request(BASE)
				.post('/mentoring/v1/sessions/update')
				.set('x-auth-token', mentorDetails.token)
				.send({
					title: 'Session for unauthorized join test',
					description: 'desc',
					type: 'PUBLIC',
					start_date: startDateTimestamp,
					end_date: endDateTimestamp,
					time_zone: 'Asia/Calcutta',
					mentor_id: mentorDetails.userId.toString(),
				})
			expect(createRes.status).toBe(201)
			const sessionId = createRes.body.result.id

			// Step 2: Attempt to join the session without a token
			const url = `/mentoring/v1/mentees/joinSession/${sessionId}`
			const res = await request(BASE).get(url)
			expect([401, 403]).toContain(res.status)
		})
	})

	describe('PATCH /mentoring/v1/sessions/completed/{sessionId}', () => {
		let sessionId

		beforeAll(async () => {
			// Create a session that has passed to mark as complete
			const now = new Date()
			const startDate = new Date(now.getTime() - 2 * 60 * 60 * 1000) // 2 hours ago
			const startDateTimestamp = Math.floor(startDate.getTime() / 1000)
			const endDate = new Date(startDate.getTime() + 60 * 60 * 1000) // 1 hour duration
			const endDateTimestamp = Math.floor(endDate.getTime() / 1000)

			const createRes = await request(BASE)
				.post('/mentoring/v1/sessions/update')
				.set('x-auth-token', userDetails.token)
				.send({
					title: 'Session to be completed',
					description: 'This session is created to test the completion endpoint.',
					type: 'PUBLIC',
					start_date: startDateTimestamp,
					end_date: endDateTimestamp,
					time_zone: 'Asia/Calcutta',
					mentor_id: userDetails.userId.toString(),
				})

			expect(createRes.status).toBe(201)
			sessionId = createRes.body.result.id
		})

		test('should return 200 on success', async () => {
			// First, start the session
			const startUrl = `/mentoring/v1/sessions/start/${sessionId}`
			const startRes = await request(BASE).get(startUrl).set('x-auth-token', userDetails.token)
			expect(startRes.status).toBe(200)

			// Then, mark the session as completed
			const url = `/mentoring/v1/sessions/completed/${sessionId}`
			let req = request(BASE).patch(url)
			req = req.set('x-auth-token', userDetails.token) // Make the API call
			const res = await req
			expect(res.status).toBe(200)
			// const schema = schemas['PATCH_/mentoring/v1/sessions/completed/{sessionId}']
			// expect(res.body).toMatchSchema(schema)
		})
	})

	describe('Session Feedback Submission', () => {
		let feedbackSessionId

		beforeAll(async () => {
			let userDetails = await commonHelper.mentorLogIn()
			// Create a session that has passed to mark as complete
			const now = new Date()
			const startDate = new Date(now.getTime() - 2 * 60 * 60 * 1000) // 2 hours ago
			const startDateTimestamp = Math.floor(startDate.getTime() / 1000)
			const endDate = new Date(startDate.getTime() + 60 * 60 * 1000) // 1 hour duration
			const endDateTimestamp = Math.floor(endDate.getTime() / 1000)

			const createRes = await request(BASE)
				.post('/mentoring/v1/sessions/update')
				.set('x-auth-token', userDetails.token)
				.send({
					title: 'Session for Feedback Test',
					description: 'This session is created to test the feedback endpoint.',
					type: 'PUBLIC',
					start_date: startDateTimestamp,
					end_date: endDateTimestamp,
					time_zone: 'Asia/Calcutta',
					mentor_id: userDetails.userId.toString(),
				})

			expect(createRes.status).toBe(201)
			feedbackSessionId = createRes.body.result.id

			// Enroll mentee in the session
			const enrollUrl = `/mentoring/v1/sessions/enroll/${feedbackSessionId}`
			const enrollRes = await request(BASE)
				.post(enrollUrl)
				.set('x-auth-token', menteeDetails.token)
				.set('timezone', 'Asia/Calcutta')
			expect(enrollRes.status).toBe(201)

			// Start the session
			const startUrl = `/mentoring/v1/sessions/start/${feedbackSessionId}`
			const startRes = await request(BASE).get(startUrl).set('x-auth-token', userDetails.token)
			expect(startRes.status).toBe(200)

			// Complete the session
			const completeUrl = `/mentoring/v1/sessions/completed/${feedbackSessionId}`
			const completeRes = await request(BASE).patch(completeUrl).set('x-auth-token', userDetails.token)
			expect(completeRes.status).toBe(200)
		})

		test('POST /mentoring/v1/feedback/submit/{sessionId} - mentee feedback should return 200', async () => {
			const url = `/mentoring/v1/feedback/submit/${feedbackSessionId}`
			const menteeFeedbackPayload = {
				feedbacks: [
					{ question_id: 3, value: 3, label: 'How would you rate the host of the session?' },
					{ question_id: 4, value: 4, label: 'How would you rate the engagement in the session?' },
				],
				feedback_as: 'mentee',
			}
			const res = await request(BASE)
				.post(url)
				.set('x-auth-token', menteeDetails.token)
				.send(menteeFeedbackPayload)
			expect(res.status).toBe(200)
		})

		test('POST /mentoring/v1/feedback/submit/{sessionId} - mentor feedback should return 200', async () => {
			const url = `/mentoring/v1/feedback/submit/${feedbackSessionId}`
			const mentorFeedbackPayload = {
				feedbacks: [
					{ question_id: 1, value: 4, label: 'How would you rate the engagement in the session?' },
					{ question_id: 2, value: 3, label: 'How would you rate the Audio/Video quality?' },
				],
				feedback_as: 'mentor',
			}
			const res = await request(BASE).post(url).set('x-auth-token', userDetails.token).send(mentorFeedbackPayload)
			expect(res.status).toBe(200)
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

  */
	/*
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
