jest.setTimeout(100000)
const request = require('supertest')
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const commonHelper = require('@commonTests')
let userDetails = null
let filterMentorDetails = null
let adminDetails = null
const schemas = require('./schemas/mentors.schemas.json')

beforeAll(async () => {
	console.log('setting up global variables....')
	adminDetails = await commonHelper.adminLogin()
	userDetails = await commonHelper.mentorLogIn()

	// Create a second mentor with known profile data for filter/search tests
	filterMentorDetails = await commonHelper.mentorLogIn()
	await request(BASE)
		.post('/mentoring/v1/profile/update')
		.set('x-auth-token', filterMentorDetails.token)
		.send({
			designation: ['deo'],
			area_of_expertise: ['educational_leadership'],
			experience: '3',
		})

	// Rebuild materialized views so the new mentor appears in directory
	await request(BASE).get('/mentoring/v1/admin/triggerViewRebuild').set('x-auth-token', adminDetails.token)
})

describe('mentors endpoints generated from api-doc.yaml', () => {
	/*
  describe('GET /mentoring/v1/mentors/details/{mentorId}', () => {
    test('should return 200', async () => {
      const url = `/mentoring/v1/mentors/details/62a820225ff93f30cfe5f990`;
      let req = request(BASE).get(url);
      req = req.set('x-auth-token', "string");
      const res = await req
			expect(res.status).toBe(200)
			expect(res.body).toMatchSchema(schemas['GET_/mentoring/v1/mentors/details/{mentorId}'])
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
      const res = await req
			expect(res.status).toBe(200)
			expect(res.body).toMatchSchema(schemas['GET_/mentoring/v1/mentors/reports'])
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
      const res = await req
			expect(res.status).toBe(200)
			expect(res.body).toMatchSchema(schemas['GET_/mentoring/v1/mentors/upcomingSessions/{mentorId}'])
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
      const res = await req
			expect(res.status).toBe(200)
			expect(res.body).toMatchSchema(schemas['GET_/mentoring/v1/mentors/share/{mentorId}'])
    });

    test('should return 401/403 when unauthorized', async () => {
      const url = `/mentoring/v1/mentors/share/21`;
      const res = await request(BASE).get(url);
      expect([401,403]).toContain(res.status);
    });

    
  });

  */

	describe('GET /mentoring/v1/mentors/list', () => {
		test('should return 200 with no filters', async () => {
			const res = await request(BASE)
				.get('/mentoring/v1/mentors/list?page=1&limit=10&search=&directory=true&search_on=')
				.set('x-auth-token', userDetails.token)
			expect(res.status).toBe(200)
			expect(res.body).toMatchSchema(schemas['GET_/mentoring/v1/mentors/list'])
		})

		test('should return 401/403 when unauthorized', async () => {
			const res = await request(BASE).get(
				'/mentoring/v1/mentors/list?page=1&limit=10&search=&directory=true&search_on='
			)
			expect([401, 403]).toContain(res.status)
		})

		test('should filter by area_of_expertise', async () => {
			const res = await request(BASE)
				.get(
					'/mentoring/v1/mentors/list?page=1&limit=10&directory=true&area_of_expertise=educational_leadership'
				)
				.set('x-auth-token', userDetails.token)
			expect(res.status).toBe(200)
			expect(res.body).toMatchSchema(schemas['GET_/mentoring/v1/mentors/list'])
			// data is grouped by letter: [{key, values[]}] — flatMap to get flat mentor list
			const mentors = (res.body.result?.data ?? []).flatMap((group) => group.values ?? [])
			mentors.forEach((mentor) => {
				const values = (mentor.area_of_expertise ?? []).map((e) => e.value)
				expect(values).toContain('educational_leadership')
			})
		})

		test('should filter by designation', async () => {
			const res = await request(BASE)
				.get('/mentoring/v1/mentors/list?page=1&limit=10&directory=true&designation=deo')
				.set('x-auth-token', userDetails.token)
			expect(res.status).toBe(200)
			expect(res.body).toMatchSchema(schemas['GET_/mentoring/v1/mentors/list'])
			// data is grouped by letter: [{key, values[]}] — flatMap to get flat mentor list
			const mentors = (res.body.result?.data ?? []).flatMap((group) => group.values ?? [])
			mentors.forEach((mentor) => {
				const values = (mentor.designation ?? []).map((e) => e.value)
				expect(values).toContain('deo')
			})
		})

		test('should filter by multiple entity types combined', async () => {
			const res = await request(BASE)
				.get(
					'/mentoring/v1/mentors/list?page=1&limit=10&directory=true&area_of_expertise=educational_leadership&designation=deo'
				)
				.set('x-auth-token', userDetails.token)
			expect(res.status).toBe(200)
			expect(res.body).toMatchSchema(schemas['GET_/mentoring/v1/mentors/list'])
		})

		test('should return results for a valid name search', async () => {
			// search param must be base64-encoded (pagination middleware decodes it before use)
			const searchParam = Buffer.from('Nev').toString('base64') // 'TmV2'
			const res = await request(BASE)
				.get(`/mentoring/v1/mentors/list?page=1&limit=10&directory=true&search=${searchParam}&search_on=name`)
				.set('x-auth-token', userDetails.token)
			expect(res.status).toBe(200)
			expect(res.body).toMatchSchema(schemas['GET_/mentoring/v1/mentors/list'])
		})

		test('should return empty data for a search with no matches', async () => {
			// base64 of 'xyz' = 'eHl6' — no mentor name will match this
			const searchParam = Buffer.from('xyz').toString('base64') // 'eHl6'
			const res = await request(BASE)
				.get(`/mentoring/v1/mentors/list?page=1&limit=10&directory=true&search=${searchParam}&search_on=name`)
				.set('x-auth-token', userDetails.token)
			expect(res.status).toBe(200)
			expect(res.body.result.count).toBe(0)
		})

		test('should sort by name ascending', async () => {
			const res = await request(BASE)
				.get('/mentoring/v1/mentors/list?page=1&limit=10&directory=true&sort_by=name&order=ASC')
				.set('x-auth-token', userDetails.token)
			expect(res.status).toBe(200)
			expect(res.body).toMatchSchema(schemas['GET_/mentoring/v1/mentors/list'])
		})

		test('should sort by name descending', async () => {
			const res = await request(BASE)
				.get('/mentoring/v1/mentors/list?page=1&limit=10&directory=true&sort_by=name&order=DESC')
				.set('x-auth-token', userDetails.token)
			expect(res.status).toBe(200)
			expect(res.body).toMatchSchema(schemas['GET_/mentoring/v1/mentors/list'])
		})

		test('should respect pagination limit', async () => {
			const res = await request(BASE)
				.get('/mentoring/v1/mentors/list?page=1&limit=1&directory=true')
				.set('x-auth-token', userDetails.token)
			expect(res.status).toBe(200)
			expect(res.body.result.data.length).toBeLessThanOrEqual(1)
		})
	})

	describe('GET /mentoring/v1/mentors/createdSessions', () => {
		test('should return 200', async () => {
			const url = `/mentoring/v1/mentors/createdSessions?page=1&limit=100&search=`
			let req = request(BASE).get(url)
			req = req.set('x-auth-token', userDetails.token)
			const res = await req

			expect(res.status).toBe(200)
			expect(res.body).toMatchSchema(schemas['GET_/mentoring/v1/mentors/createdSessions'])
		})

		test('should return 401/403 when unauthorized', async () => {
			const url = `/mentoring/v1/mentors/createdSessions?page=1&limit=100&search=`
			const res = await request(BASE).get(url)
			expect([401, 403]).toContain(res.status)
		})
	})
})
