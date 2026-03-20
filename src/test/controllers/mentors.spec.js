/**
 * name : mentors.spec.js
 * author : Test Author
 * created-date : 2026-02-24
 * Description : Unit tests for mentors controller (extended version)
 */

const MentorsController = require('@controllers/v1/mentors')
const mentorsService = require('@services/mentors')
const { isAMentor } = require('@generics/utils')

jest.mock('@services/mentors')
jest.mock('@generics/utils')

describe('Mentors Controller', () => {
	let mentorsController
	let mockRequest

	beforeEach(() => {
		mentorsController = new MentorsController()
		mockRequest = {
			decodedToken: {
				id: 'user123',
				roles: [{ title: 'mentee' }],
				organization_code: 'org123',
				tenant_code: 'tenant123',
			},
			query: {},
			params: {},
			pageNo: 1,
			pageSize: 10,
			searchText: '',
			searchOn: [],
		}
		isAMentor.mockReturnValue(false)
		jest.clearAllMocks()
	})

	describe('upcomingSessions', () => {
		test('should get upcoming sessions for a mentor', async () => {
			mockRequest.params.id = 'mentor456'
			mockRequest.query = { category: 'tech' }
			const expectedResponse = {
				statusCode: 200,
				result: [{ id: 'session1' }, { id: 'session2' }],
				count: 2,
			}

			mentorsService.upcomingSessions.mockResolvedValue(expectedResponse)

			const result = await mentorsController.upcomingSessions(mockRequest)

			expect(mentorsService.upcomingSessions).toHaveBeenCalledWith(
				'mentor456',
				1,
				10,
				'',
				'user123',
				mockRequest.query,
				false,
				mockRequest.decodedToken.roles,
				'org123',
				'tenant123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should get upcoming sessions with menteeId param', async () => {
			mockRequest.params.id = 'mentor456'
			mockRequest.params.menteeId = 'mentee789'
			const expectedResponse = {
				statusCode: 200,
				result: [{ id: 'session1' }],
			}

			mentorsService.upcomingSessions.mockResolvedValue(expectedResponse)

			const result = await mentorsController.upcomingSessions(mockRequest)

			expect(mentorsService.upcomingSessions).toHaveBeenCalledWith(
				'mentor456',
				1,
				10,
				'',
				'mentee789',
				mockRequest.query,
				false,
				mockRequest.decodedToken.roles,
				'org123',
				'tenant123'
			)
		})

		test('should handle error getting upcoming sessions', async () => {
			mockRequest.params.id = 'mentor456'
			const error = new Error('Fetch failed')
			mentorsService.upcomingSessions.mockRejectedValue(error)

			const result = await mentorsController.upcomingSessions(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('details', () => {
		test('should get mentor details successfully', async () => {
			mockRequest.params.id = 'mentor456'
			const expectedResponse = {
				statusCode: 200,
				result: { id: 'mentor456', name: 'John Mentor', expertise: ['JavaScript'] },
			}

			mentorsService.read.mockResolvedValue(expectedResponse)

			const result = await mentorsController.details(mockRequest)

			expect(mentorsService.read).toHaveBeenCalledWith(
				'mentor456',
				'org123',
				'user123',
				false,
				mockRequest.decodedToken.roles,
				'tenant123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should get details when caller is a mentor', async () => {
			isAMentor.mockReturnValue(true)
			mockRequest.params.id = 'mentor456'
			const expectedResponse = {
				statusCode: 200,
				result: { id: 'mentor456', name: 'John Mentor' },
			}

			mentorsService.read.mockResolvedValue(expectedResponse)

			const result = await mentorsController.details(mockRequest)

			expect(mentorsService.read).toHaveBeenCalledWith(
				'mentor456',
				'org123',
				'user123',
				true,
				mockRequest.decodedToken.roles,
				'tenant123'
			)
		})

		test('should handle error getting details', async () => {
			mockRequest.params.id = 'mentor456'
			const error = new Error('Details fetch failed')
			mentorsService.read.mockRejectedValue(error)

			const result = await mentorsController.details(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('reports', () => {
		test('should get mentor reports successfully', async () => {
			mockRequest.query.filterType = 'MONTHLY'
			const expectedResponse = {
				statusCode: 200,
				result: { sessionsHosted: 5, attendees: 20 },
			}

			mentorsService.reports.mockResolvedValue(expectedResponse)

			const result = await mentorsController.reports(mockRequest)

			expect(mentorsService.reports).toHaveBeenCalledWith(
				'user123',
				'MONTHLY',
				mockRequest.decodedToken.roles,
				'tenant123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error getting reports', async () => {
			mockRequest.query.filterType = 'QUARTERLY'
			const error = new Error('Reports fetch failed')
			mentorsService.reports.mockRejectedValue(error)

			const result = await mentorsController.reports(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('share', () => {
		test('should get shareable mentor link', async () => {
			mockRequest.params.id = 'mentor456'
			const expectedResponse = {
				statusCode: 200,
				result: { shareLink: 'https://example.com/mentor/mentor456' },
			}

			mentorsService.share.mockResolvedValue(expectedResponse)

			const result = await mentorsController.share(mockRequest)

			expect(mentorsService.share).toHaveBeenCalledWith('mentor456', 'user123', 'org123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error getting share link', async () => {
			mockRequest.params.id = 'mentor456'
			const error = new Error('Share link failed')
			mentorsService.share.mockRejectedValue(error)

			const result = await mentorsController.share(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('list', () => {
		test('should list mentors successfully', async () => {
			mockRequest.pageNo = 1
			mockRequest.pageSize = 20
			mockRequest.searchText = 'javascript'
			mockRequest.searchOn = ['expertise']
			mockRequest.query = { category: 'tech' }
			const expectedResponse = {
				statusCode: 200,
				result: [{ id: 'mentor1' }, { id: 'mentor2' }],
				count: 2,
			}

			mentorsService.list.mockResolvedValue(expectedResponse)

			const result = await mentorsController.list(mockRequest)

			expect(mentorsService.list).toHaveBeenCalledWith(
				1,
				20,
				'javascript',
				['expertise'],
				mockRequest.query,
				'user123',
				false,
				mockRequest.decodedToken.roles,
				'org123',
				'tenant123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should list mentors when caller is a mentor', async () => {
			isAMentor.mockReturnValue(true)
			const expectedResponse = {
				statusCode: 200,
				result: [{ id: 'mentor1' }],
				count: 1,
			}

			mentorsService.list.mockResolvedValue(expectedResponse)

			const result = await mentorsController.list(mockRequest)

			expect(mentorsService.list).toHaveBeenCalledWith(
				1,
				10,
				'',
				[],
				mockRequest.query,
				'user123',
				true,
				mockRequest.decodedToken.roles,
				'org123',
				'tenant123'
			)
		})

		test('should handle error listing mentors', async () => {
			const error = new Error('List failed')
			mentorsService.list.mockRejectedValue(error)

			const result = await mentorsController.list(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('createdSessions', () => {
		test('should get sessions created by mentor', async () => {
			mockRequest.pageNo = 1
			mockRequest.pageSize = 15
			mockRequest.searchText = 'react'
			mockRequest.query.status = 'published'
			const expectedResponse = {
				statusCode: 200,
				result: [{ id: 'session1' }, { id: 'session2' }],
				count: 2,
			}

			mentorsService.createdSessions.mockResolvedValue(expectedResponse)

			const result = await mentorsController.createdSessions(mockRequest)

			expect(mentorsService.createdSessions).toHaveBeenCalledWith(
				'user123',
				1,
				15,
				'react',
				'published',
				mockRequest.decodedToken.roles,
				'org123',
				'tenant123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should handle undefined status', async () => {
			mockRequest.query = {}
			const expectedResponse = {
				statusCode: 200,
				result: [],
				count: 0,
			}

			mentorsService.createdSessions.mockResolvedValue(expectedResponse)

			const result = await mentorsController.createdSessions(mockRequest)

			expect(mentorsService.createdSessions).toHaveBeenCalledWith(
				'user123',
				1,
				10,
				'',
				undefined,
				mockRequest.decodedToken.roles,
				'org123',
				'tenant123'
			)
		})

		test('should handle error getting created sessions', async () => {
			const error = new Error('Created sessions fetch failed')
			mentorsService.createdSessions.mockRejectedValue(error)

			const result = await mentorsController.createdSessions(mockRequest)

			expect(result).toEqual(error)
		})
	})
})