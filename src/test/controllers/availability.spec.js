/**
 * name : availability.spec.js
 * author : Test Author
 * created-date : 2026-02-24
 * Description : Unit tests for availability controller
 */

const AvailabilityController = require('@controllers/v1/availability')
const availabilityService = require('@services/availability')

jest.mock('@services/availability')

describe('Availability Controller', () => {
	let availabilityController
	let mockRequest

	beforeEach(() => {
		availabilityController = new AvailabilityController()
		mockRequest = {
			decodedToken: {
				id: 'user123',
				tenant_code: 'tenant123',
			},
			body: {},
			params: {},
			query: {},
		}
		jest.clearAllMocks()
	})

	describe('create', () => {
		test('should create availability successfully', async () => {
			mockRequest.body = {
				day: 'Monday',
				start_time: '09:00',
				end_time: '17:00',
			}
			const expectedResponse = {
				statusCode: 201,
				message: 'AVAILABILITY_CREATED_SUCCESSFULLY',
			}

			availabilityService.create.mockResolvedValue(expectedResponse)

			const result = await availabilityController.create(mockRequest)

			expect(availabilityService.create).toHaveBeenCalledWith(mockRequest.body, mockRequest.decodedToken)
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during availability creation', async () => {
			mockRequest.body = { day: 'Monday' }
			const error = new Error('Creation failed')

			availabilityService.create.mockRejectedValue(error)

			const result = await availabilityController.create(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('update', () => {
		test('should update availability successfully', async () => {
			mockRequest.params.id = 'availability123'
			mockRequest.body = { end_time: '18:00' }
			const expectedResponse = {
				statusCode: 200,
				message: 'AVAILABILITY_UPDATED_SUCCESSFULLY',
			}

			availabilityService.update.mockResolvedValue(expectedResponse)

			const result = await availabilityController.update(mockRequest)

			expect(availabilityService.update).toHaveBeenCalledWith(
				'availability123',
				mockRequest.body,
				mockRequest.decodedToken
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during update', async () => {
			mockRequest.params.id = 'availability123'
			const error = new Error('Update failed')

			availabilityService.update.mockRejectedValue(error)

			const result = await availabilityController.update(mockRequest)

			expect(result).toEqual(error)
		})

		test('should handle missing id parameter', async () => {
			mockRequest.params.id = undefined
			const error = new Error('ID is required')

			availabilityService.update.mockRejectedValue(error)

			const result = await availabilityController.update(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('delete', () => {
		test('should delete availability successfully', async () => {
			mockRequest.params.id = 'availability123'
			const expectedResponse = {
				statusCode: 200,
				message: 'AVAILABILITY_DELETED_SUCCESSFULLY',
			}

			availabilityService.delete.mockResolvedValue(expectedResponse)

			const result = await availabilityController.delete(mockRequest)

			expect(availabilityService.delete).toHaveBeenCalledWith('availability123', mockRequest.decodedToken)
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during deletion', async () => {
			mockRequest.params.id = 'availability123'
			const error = new Error('Deletion failed')

			availabilityService.delete.mockRejectedValue(error)

			const result = await availabilityController.delete(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('read', () => {
		test('should read availability successfully', async () => {
			mockRequest.params.id = 'availability123'
			mockRequest.query = { includeDetails: 'true' }
			const expectedResponse = {
				statusCode: 200,
				result: { id: 'availability123', day: 'Monday' },
			}

			availabilityService.read.mockResolvedValue(expectedResponse)

			const result = await availabilityController.read(mockRequest)

			expect(availabilityService.read).toHaveBeenCalledWith(mockRequest.query, 'availability123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during read', async () => {
			mockRequest.params.id = 'availability123'
			const error = new Error('Read failed')

			availabilityService.read.mockRejectedValue(error)

			const result = await availabilityController.read(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('isAvailable', () => {
		test('should check availability successfully', async () => {
			mockRequest.params.id = 'user456'
			mockRequest.query = { date: '2026-02-25', time: '10:00' }
			const expectedResponse = {
				statusCode: 200,
				result: { available: true },
			}

			availabilityService.isAvailable.mockResolvedValue(expectedResponse)

			const result = await availabilityController.isAvailable(mockRequest)

			expect(availabilityService.isAvailable).toHaveBeenCalledWith(mockRequest.query, 'user456', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during availability check', async () => {
			mockRequest.params.id = 'user456'
			const error = new Error('Check failed')

			availabilityService.isAvailable.mockRejectedValue(error)

			const result = await availabilityController.isAvailable(mockRequest)

			expect(result).toEqual(error)
		})

		test('should return false when user is not available', async () => {
			mockRequest.params.id = 'user456'
			mockRequest.query = { date: '2026-02-25', time: '22:00' }
			const expectedResponse = {
				statusCode: 200,
				result: { available: false },
			}

			availabilityService.isAvailable.mockResolvedValue(expectedResponse)

			const result = await availabilityController.isAvailable(mockRequest)

			expect(result.result.available).toBe(false)
		})
	})

	describe('users', () => {
		test('should get available users successfully', async () => {
			mockRequest.params.id = 'slot123'
			mockRequest.query = { date: '2026-02-25' }
			const expectedResponse = {
				statusCode: 200,
				result: [{ id: 'user1' }, { id: 'user2' }],
			}

			availabilityService.users.mockResolvedValue(expectedResponse)

			const result = await availabilityController.users(mockRequest)

			expect(availabilityService.users).toHaveBeenCalledWith(mockRequest.query, 'slot123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during users retrieval', async () => {
			mockRequest.params.id = 'slot123'
			const error = new Error('Users retrieval failed')

			availabilityService.users.mockRejectedValue(error)

			const result = await availabilityController.users(mockRequest)

			expect(result).toEqual(error)
		})

		test('should handle empty users list', async () => {
			mockRequest.params.id = 'slot123'
			const expectedResponse = {
				statusCode: 200,
				result: [],
			}

			availabilityService.users.mockResolvedValue(expectedResponse)

			const result = await availabilityController.users(mockRequest)

			expect(result.result).toEqual([])
		})
	})
})