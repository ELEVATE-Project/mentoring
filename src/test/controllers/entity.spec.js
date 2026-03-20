/**
 * name : entity.spec.js
 * author : Test Author
 * created-date : 2026-02-24
 * Description : Unit tests for entity controller
 */

const EntityController = require('@controllers/v1/entity')
const entityService = require('@services/entity')

jest.mock('@services/entity')

describe('Entity Controller', () => {
	let entityController
	let mockRequest

	beforeEach(() => {
		entityController = new EntityController()
		mockRequest = {
			decodedToken: {
				id: 'user123',
				tenant_code: 'tenant123',
			},
			body: {},
			params: {},
			query: {},
			searchText: '',
			pageNo: 1,
			pageSize: 10,
		}
		jest.clearAllMocks()
	})

	describe('create', () => {
		test('should create entity successfully', async () => {
			mockRequest.body = {
				type: 'designation',
				value: 'Senior Developer',
			}
			const expectedResponse = {
				statusCode: 201,
				message: 'ENTITY_CREATED_SUCCESSFULLY',
			}

			entityService.create.mockResolvedValue(expectedResponse)

			const result = await entityController.create(mockRequest)

			expect(entityService.create).toHaveBeenCalledWith(mockRequest.body, 'user123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during creation', async () => {
			const error = new Error('Creation failed')
			entityService.create.mockRejectedValue(error)

			const result = await entityController.create(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('update', () => {
		test('should update entity successfully', async () => {
			mockRequest.params.id = 'entity123'
			mockRequest.body = { value: 'Updated Value' }
			const expectedResponse = {
				statusCode: 200,
				message: 'ENTITY_UPDATED_SUCCESSFULLY',
			}

			entityService.update.mockResolvedValue(expectedResponse)

			const result = await entityController.update(mockRequest)

			expect(entityService.update).toHaveBeenCalledWith(mockRequest.body, 'entity123', 'user123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during update', async () => {
			mockRequest.params.id = 'entity123'
			const error = new Error('Update failed')
			entityService.update.mockRejectedValue(error)

			const result = await entityController.update(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('read', () => {
		test('should read single entity by id', async () => {
			mockRequest.query.id = 'entity123'
			const expectedResponse = {
				statusCode: 200,
				result: { id: 'entity123', value: 'Test Entity' },
			}

			entityService.read.mockResolvedValue(expectedResponse)

			const result = await entityController.read(mockRequest)

			expect(entityService.read).toHaveBeenCalledWith(mockRequest.query, 'user123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should read single entity by value', async () => {
			mockRequest.query.value = 'TestValue'
			const expectedResponse = {
				statusCode: 200,
				result: { id: 'entity123', value: 'TestValue' },
			}

			entityService.read.mockResolvedValue(expectedResponse)

			const result = await entityController.read(mockRequest)

			expect(entityService.read).toHaveBeenCalledWith(mockRequest.query, 'user123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should read all entities when no id or value', async () => {
			mockRequest.query = {}
			const expectedResponse = {
				statusCode: 200,
				result: [{ id: 'entity1' }, { id: 'entity2' }],
			}

			entityService.readAll.mockResolvedValue(expectedResponse)

			const result = await entityController.read(mockRequest)

			expect(entityService.readAll).toHaveBeenCalledWith(mockRequest.query, 'user123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during read', async () => {
			const error = new Error('Read failed')
			entityService.readAll.mockRejectedValue(error)

			const result = await entityController.read(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('delete', () => {
		test('should delete entity successfully', async () => {
			mockRequest.params.id = 'entity123'
			const expectedResponse = {
				statusCode: 200,
				message: 'ENTITY_DELETED_SUCCESSFULLY',
			}

			entityService.delete.mockResolvedValue(expectedResponse)

			const result = await entityController.delete(mockRequest)

			expect(entityService.delete).toHaveBeenCalledWith('entity123', 'user123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during deletion', async () => {
			mockRequest.params.id = 'entity123'
			const error = new Error('Deletion failed')
			entityService.delete.mockRejectedValue(error)

			const result = await entityController.delete(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('list', () => {
		test('should list entities with pagination', async () => {
			mockRequest.pageNo = 2
			mockRequest.pageSize = 20
			mockRequest.searchText = 'developer'
			mockRequest.query = { type: 'designation' }
			const expectedResponse = {
				statusCode: 200,
				result: [{ id: 'entity1' }, { id: 'entity2' }],
				count: 50,
			}

			entityService.list.mockResolvedValue(expectedResponse)

			const result = await entityController.list(mockRequest)

			expect(entityService.list).toHaveBeenCalledWith(
				mockRequest.query,
				'developer',
				2,
				20,
				'tenant123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should list entities without search text', async () => {
			mockRequest.searchText = ''
			const expectedResponse = {
				statusCode: 200,
				result: [{ id: 'entity1' }],
				count: 1,
			}

			entityService.list.mockResolvedValue(expectedResponse)

			const result = await entityController.list(mockRequest)

			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during list', async () => {
			const error = new Error('List failed')
			entityService.list.mockRejectedValue(error)

			const result = await entityController.list(mockRequest)

			expect(result).toEqual(error)
		})
	})
})