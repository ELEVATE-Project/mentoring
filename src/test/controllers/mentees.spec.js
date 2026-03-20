/**
 * name : mentees.spec.js
 * author : Test Author
 * created-date : 2026-02-24
 * Description : Unit tests for mentees controller
 */

const MenteesController = require('@controllers/v1/mentees')
const menteesService = require('@services/mentees')
const { isAMentor } = require('@generics/utils')

jest.mock('@services/mentees')
jest.mock('@generics/utils')

describe('Mentees Controller', () => {
	let menteesController
	let mockRequest

	beforeEach(() => {
		menteesController = new MenteesController()
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
		}
		isAMentor.mockReturnValue(false)
		jest.clearAllMocks()
	})

	describe('sessions', () => {
		test('should get mentee sessions successfully', async () => {
			const expectedResponse = {
				statusCode: 200,
				result: [{ id: 'session1' }, { id: 'session2' }],
				count: 2,
			}

			menteesService.sessions.mockResolvedValue(expectedResponse)

			const result = await menteesController.sessions(mockRequest)

			expect(menteesService.sessions).toHaveBeenCalledWith('user123', 1, 10, '', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error getting sessions', async () => {
			const error = new Error('Sessions fetch failed')
			menteesService.sessions.mockRejectedValue(error)

			const result = await menteesController.sessions(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('reports', () => {
		test('should get mentee reports with filter type', async () => {
			mockRequest.query.filterType = 'MONTHLY'
			const expectedResponse = {
				statusCode: 200,
				result: { sessionsAttended: 10, hoursSpent: 20 },
			}

			menteesService.reports.mockResolvedValue(expectedResponse)

			const result = await menteesController.reports(mockRequest)

			expect(menteesService.reports).toHaveBeenCalledWith('user123', 'MONTHLY', 'org123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should get quarterly reports', async () => {
			mockRequest.query.filterType = 'QUARTERLY'
			const expectedResponse = {
				statusCode: 200,
				result: { sessionsAttended: 30, hoursSpent: 60 },
			}

			menteesService.reports.mockResolvedValue(expectedResponse)

			const result = await menteesController.reports(mockRequest)

			expect(menteesService.reports).toHaveBeenCalledWith('user123', 'QUARTERLY', 'org123', 'tenant123')
		})

		test('should handle error getting reports', async () => {
			mockRequest.query.filterType = 'WEEKLY'
			const error = new Error('Reports fetch failed')
			menteesService.reports.mockRejectedValue(error)

			const result = await menteesController.reports(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('homeFeed', () => {
		test('should get mentee home feed successfully', async () => {
			mockRequest.query.start_date = '2026-01-01'
			mockRequest.query.end_date = '2026-12-31'
			const expectedResponse = {
				statusCode: 200,
				result: { sessions: [], mentors: [] },
			}

			menteesService.homeFeed.mockResolvedValue(expectedResponse)

			const result = await menteesController.homeFeed(mockRequest)

			expect(isAMentor).toHaveBeenCalledWith(mockRequest.decodedToken.roles)
			expect(menteesService.homeFeed).toHaveBeenCalledWith(
				'user123',
				false,
				1,
				10,
				'',
				mockRequest.query,
				mockRequest.decodedToken.roles,
				'org123',
				'2026-01-01',
				'2026-12-31',
				'tenant123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should get home feed for user who is also a mentor', async () => {
			isAMentor.mockReturnValue(true)
			const expectedResponse = {
				statusCode: 200,
				result: { sessions: [], mentors: [] },
			}

			menteesService.homeFeed.mockResolvedValue(expectedResponse)

			const result = await menteesController.homeFeed(mockRequest)

			expect(menteesService.homeFeed).toHaveBeenCalledWith(
				'user123',
				true,
				1,
				10,
				'',
				mockRequest.query,
				mockRequest.decodedToken.roles,
				'org123',
				undefined,
				undefined,
				'tenant123'
			)
		})

		test('should handle error getting home feed', async () => {
			const error = new Error('Home feed fetch failed')
			menteesService.homeFeed.mockRejectedValue(error)

			const result = await menteesController.homeFeed(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('joinSession', () => {
		test('should join session successfully', async () => {
			mockRequest.params.id = 'session123'
			const expectedResponse = {
				statusCode: 200,
				result: { meetingLink: 'https://meet.example.com/session123' },
			}

			menteesService.joinSession.mockResolvedValue(expectedResponse)

			const result = await menteesController.joinSession(mockRequest)

			expect(menteesService.joinSession).toHaveBeenCalledWith('session123', 'user123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error joining session', async () => {
			mockRequest.params.id = 'session123'
			const error = new Error('Join failed')
			menteesService.joinSession.mockRejectedValue(error)

			const result = await menteesController.joinSession(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('list', () => {
		test('should list mentees successfully', async () => {
			mockRequest.pageNo = 2
			mockRequest.pageSize = 20
			mockRequest.searchText = 'john'
			mockRequest.query = { designation: 'student' }
			const expectedResponse = {
				statusCode: 200,
				result: [{ id: 'mentee1' }, { id: 'mentee2' }],
				count: 50,
			}

			menteesService.list.mockResolvedValue(expectedResponse)

			const result = await menteesController.list(mockRequest)

			expect(menteesService.list).toHaveBeenCalledWith(
				2,
				20,
				'john',
				mockRequest.query,
				'user123',
				false,
				'org123',
				'tenant123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should list mentees when caller is a mentor', async () => {
			isAMentor.mockReturnValue(true)
			const expectedResponse = {
				statusCode: 200,
				result: [{ id: 'mentee1' }],
				count: 1,
			}

			menteesService.list.mockResolvedValue(expectedResponse)

			const result = await menteesController.list(mockRequest)

			expect(menteesService.list).toHaveBeenCalledWith(
				1,
				10,
				'',
				mockRequest.query,
				'user123',
				true,
				'org123',
				'tenant123'
			)
		})

		test('should handle error listing mentees', async () => {
			const error = new Error('List failed')
			menteesService.list.mockRejectedValue(error)

			const result = await menteesController.list(mockRequest)

			expect(result).toEqual(error)
		})
	})
})