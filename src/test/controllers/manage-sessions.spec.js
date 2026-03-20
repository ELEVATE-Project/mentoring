/**
 * name : manage-sessions.spec.js
 * author : Test Author
 * created-date : 2026-02-24
 * Description : Unit tests for manage-sessions controller
 */

const ManageSessionsController = require('@controllers/v1/manage-sessions')
const sessionService = require('@services/sessions')

jest.mock('@services/sessions')

describe('ManageSessions Controller', () => {
	let manageSessionsController
	let mockRequest

	beforeEach(() => {
		manageSessionsController = new ManageSessionsController()
		mockRequest = {
			decodedToken: {
				id: 'sessionManager123',
				tenant_code: 'tenant123',
			},
			query: {},
			pageNo: 1,
			pageSize: 10,
			searchText: '',
		}
		jest.clearAllMocks()
	})

	describe('downloadSessions', () => {
		test('should download sessions successfully', async () => {
			mockRequest.query = {
				timezone: 'Asia/Kolkata',
				status: 'published',
			}
			mockRequest.searchText = 'javascript'
			const expectedResponse = {
				statusCode: 200,
				result: Buffer.from('session1,session2,session3'),
			}

			sessionService.downloadList.mockResolvedValue(expectedResponse)

			const result = await manageSessionsController.downloadSessions(mockRequest)

			expect(sessionService.downloadList).toHaveBeenCalledWith(
				'sessionManager123',
				mockRequest.query,
				'Asia/Kolkata',
				'javascript',
				'tenant123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should download sessions without search text', async () => {
			mockRequest.query = {
				timezone: 'UTC',
			}
			mockRequest.searchText = ''
			const expectedResponse = {
				statusCode: 200,
				result: Buffer.from('all sessions'),
			}

			sessionService.downloadList.mockResolvedValue(expectedResponse)

			const result = await manageSessionsController.downloadSessions(mockRequest)

			expect(sessionService.downloadList).toHaveBeenCalledWith(
				'sessionManager123',
				mockRequest.query,
				'UTC',
				'',
				'tenant123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during download', async () => {
			mockRequest.query = { timezone: 'UTC' }
			const error = new Error('Download failed')

			sessionService.downloadList.mockRejectedValue(error)

			await expect(manageSessionsController.downloadSessions(mockRequest)).rejects.toThrow('Download failed')
		})

		test('should handle missing timezone', async () => {
			mockRequest.query = {}
			const expectedResponse = {
				statusCode: 200,
				result: Buffer.from('sessions'),
			}

			sessionService.downloadList.mockResolvedValue(expectedResponse)

			const result = await manageSessionsController.downloadSessions(mockRequest)

			expect(sessionService.downloadList).toHaveBeenCalledWith(
				'sessionManager123',
				mockRequest.query,
				undefined,
				'',
				'tenant123'
			)
		})
	})

	describe('createdSessions', () => {
		test('should get created sessions successfully', async () => {
			mockRequest.query = {
				timezone: 'Asia/Kolkata',
				status: 'completed',
			}
			mockRequest.pageNo = 2
			mockRequest.pageSize = 20
			mockRequest.searchText = 'mentoring'
			const expectedResponse = {
				statusCode: 200,
				result: [
					{ id: 'session1', title: 'Mentoring Session 1' },
					{ id: 'session2', title: 'Mentoring Session 2' },
				],
				count: 50,
			}

			sessionService.createdSessions.mockResolvedValue(expectedResponse)

			const result = await manageSessionsController.createdSessions(mockRequest)

			expect(sessionService.createdSessions).toHaveBeenCalledWith(
				'sessionManager123',
				mockRequest.query,
				'Asia/Kolkata',
				2,
				20,
				'mentoring',
				'tenant123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should get created sessions with default pagination', async () => {
			mockRequest.query = {
				timezone: 'UTC',
			}
			mockRequest.pageNo = 1
			mockRequest.pageSize = 10
			const expectedResponse = {
				statusCode: 200,
				result: [{ id: 'session1' }],
				count: 1,
			}

			sessionService.createdSessions.mockResolvedValue(expectedResponse)

			const result = await manageSessionsController.createdSessions(mockRequest)

			expect(sessionService.createdSessions).toHaveBeenCalledWith(
				'sessionManager123',
				mockRequest.query,
				'UTC',
				1,
				10,
				'',
				'tenant123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should handle empty created sessions', async () => {
			mockRequest.query = { timezone: 'UTC' }
			const expectedResponse = {
				statusCode: 200,
				result: [],
				count: 0,
			}

			sessionService.createdSessions.mockResolvedValue(expectedResponse)

			const result = await manageSessionsController.createdSessions(mockRequest)

			expect(result.result).toEqual([])
			expect(result.count).toBe(0)
		})

		test('should handle error during retrieval', async () => {
			mockRequest.query = { timezone: 'UTC' }
			const error = new Error('Retrieval failed')

			sessionService.createdSessions.mockRejectedValue(error)

			await expect(manageSessionsController.createdSessions(mockRequest)).rejects.toThrow('Retrieval failed')
		})

		test('should pass search text correctly', async () => {
			mockRequest.searchText = 'advanced'
			mockRequest.query = { timezone: 'UTC' }
			const expectedResponse = {
				statusCode: 200,
				result: [{ id: 'session1', title: 'Advanced Session' }],
				count: 1,
			}

			sessionService.createdSessions.mockResolvedValue(expectedResponse)

			const result = await manageSessionsController.createdSessions(mockRequest)

			expect(sessionService.createdSessions).toHaveBeenCalledWith(
				'sessionManager123',
				mockRequest.query,
				'UTC',
				1,
				10,
				'advanced',
				'tenant123'
			)
		})
	})
})