/**
 * name : connections.spec.js
 * author : Test Author
 * created-date : 2026-02-24
 * Description : Unit tests for connections controller
 */

const ConnectionsController = require('@controllers/v1/connections')
const connectionsService = require('@services/connections')

jest.mock('@services/connections')

describe('Connections Controller', () => {
	let connectionsController
	let mockRequest

	beforeEach(() => {
		connectionsController = new ConnectionsController()
		mockRequest = {
			decodedToken: {
				id: 'user123',
				tenant_code: 'tenant123',
				organization_code: 'org123',
			},
			body: {},
			params: {},
			query: {},
			pageNo: 1,
			pageSize: 10,
			searchText: '',
		}
		jest.clearAllMocks()
	})

	describe('getInfo', () => {
		test('should get connection info successfully', async () => {
			mockRequest.body = { user_id: 'user456' }
			const expectedResponse = {
				statusCode: 200,
				result: { status: 'ACCEPTED', connectedAt: '2026-02-24' },
			}

			connectionsService.getInfo.mockResolvedValue(expectedResponse)

			const result = await connectionsController.getInfo(mockRequest)

			expect(connectionsService.getInfo).toHaveBeenCalledWith('user456', 'user123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error getting connection info', async () => {
			mockRequest.body = { user_id: 'user456' }
			const error = new Error('Connection not found')

			connectionsService.getInfo.mockRejectedValue(error)

			await expect(connectionsController.getInfo(mockRequest)).rejects.toThrow('Connection not found')
		})
	})

	describe('initiate', () => {
		test('should initiate connection successfully', async () => {
			mockRequest.body = {
				user_id: 'user456',
				message: 'Hi, would like to connect',
			}
			const expectedResponse = {
				statusCode: 201,
				message: 'CONNECTION_REQUEST_SENT',
			}

			connectionsService.initiate.mockResolvedValue(expectedResponse)

			const result = await connectionsController.initiate(mockRequest)

			expect(connectionsService.initiate).toHaveBeenCalledWith(mockRequest.body, 'user123', 'tenant123', 'org123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during connection initiation', async () => {
			mockRequest.body = { user_id: 'user456' }
			const error = new Error('Initiation failed')

			connectionsService.initiate.mockRejectedValue(error)

			await expect(connectionsController.initiate(mockRequest)).rejects.toThrow('Initiation failed')
		})
	})

	describe('pending', () => {
		test('should get pending connections successfully', async () => {
			mockRequest.pageNo = 1
			mockRequest.pageSize = 20
			const expectedResponse = {
				statusCode: 200,
				result: [{ id: 'conn1' }, { id: 'conn2' }],
				count: 2,
			}

			connectionsService.pending.mockResolvedValue(expectedResponse)

			const result = await connectionsController.pending(mockRequest)

			expect(connectionsService.pending).toHaveBeenCalledWith('user123', 1, 20, 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle empty pending connections', async () => {
			const expectedResponse = {
				statusCode: 200,
				result: [],
				count: 0,
			}

			connectionsService.pending.mockResolvedValue(expectedResponse)

			const result = await connectionsController.pending(mockRequest)

			expect(result.result).toEqual([])
		})

		test('should handle error getting pending connections', async () => {
			const error = new Error('Fetch failed')

			connectionsService.pending.mockRejectedValue(error)

			await expect(connectionsController.pending(mockRequest)).rejects.toThrow('Fetch failed')
		})
	})

	describe('accept', () => {
		test('should accept connection successfully', async () => {
			mockRequest.body = { connection_id: 'conn123' }
			const expectedResponse = {
				statusCode: 200,
				message: 'CONNECTION_ACCEPTED',
			}

			connectionsService.accept.mockResolvedValue(expectedResponse)

			const result = await connectionsController.accept(mockRequest)

			expect(connectionsService.accept).toHaveBeenCalledWith(mockRequest.body, 'user123', 'org123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during accept', async () => {
			mockRequest.body = { connection_id: 'conn123' }
			const error = new Error('Accept failed')

			connectionsService.accept.mockRejectedValue(error)

			await expect(connectionsController.accept(mockRequest)).rejects.toThrow('Accept failed')
		})
	})

	describe('reject', () => {
		test('should reject connection successfully', async () => {
			mockRequest.body = { connection_id: 'conn123' }
			const expectedResponse = {
				statusCode: 200,
				message: 'CONNECTION_REJECTED',
			}

			connectionsService.reject.mockResolvedValue(expectedResponse)

			const result = await connectionsController.reject(mockRequest)

			expect(connectionsService.reject).toHaveBeenCalledWith(mockRequest.body, 'user123', 'org123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during reject', async () => {
			mockRequest.body = { connection_id: 'conn123' }
			const error = new Error('Reject failed')

			connectionsService.reject.mockRejectedValue(error)

			await expect(connectionsController.reject(mockRequest)).rejects.toThrow('Reject failed')
		})
	})

	describe('list', () => {
		test('should list connections successfully', async () => {
			mockRequest.pageNo = 1
			mockRequest.pageSize = 10
			mockRequest.searchText = 'john'
			mockRequest.query = { status: 'ACCEPTED' }
			const expectedResponse = {
				statusCode: 200,
				result: [{ id: 'conn1' }, { id: 'conn2' }],
				count: 2,
			}

			connectionsService.list.mockResolvedValue(expectedResponse)

			const result = await connectionsController.list(mockRequest)

			expect(connectionsService.list).toHaveBeenCalledWith(
				1,
				10,
				'john',
				{ status: 'ACCEPTED' },
				'user123',
				'org123',
				'tenant123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should handle empty connections list', async () => {
			const expectedResponse = {
				statusCode: 200,
				result: [],
				count: 0,
			}

			connectionsService.list.mockResolvedValue(expectedResponse)

			const result = await connectionsController.list(mockRequest)

			expect(result.result).toEqual([])
		})

		test('should handle error listing connections', async () => {
			const error = new Error('List failed')

			connectionsService.list.mockRejectedValue(error)

			await expect(connectionsController.list(mockRequest)).rejects.toThrow('List failed')
		})
	})

	describe('checkConnection', () => {
		test('should check if connection exists', async () => {
			mockRequest.body = { user_id: 'user456' }
			const expectedResponse = {
				statusCode: 200,
				result: { exists: true, status: 'ACCEPTED' },
			}

			connectionsService.checkConnectionIfExists.mockResolvedValue(expectedResponse)

			const result = await connectionsController.checkConnection(mockRequest)

			expect(connectionsService.checkConnectionIfExists).toHaveBeenCalledWith('user123', mockRequest.body, 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should return false when connection does not exist', async () => {
			mockRequest.body = { user_id: 'user456' }
			const expectedResponse = {
				statusCode: 200,
				result: { exists: false },
			}

			connectionsService.checkConnectionIfExists.mockResolvedValue(expectedResponse)

			const result = await connectionsController.checkConnection(mockRequest)

			expect(result.result.exists).toBe(false)
		})

		test('should handle error checking connection', async () => {
			mockRequest.body = { user_id: 'user456' }
			const error = new Error('Check failed')

			connectionsService.checkConnectionIfExists.mockRejectedValue(error)

			await expect(connectionsController.checkConnection(mockRequest)).rejects.toThrow('Check failed')
		})
	})
})