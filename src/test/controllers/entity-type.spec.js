/**
 * name : entity-type.spec.js
 * author : Test Author
 * created-date : 2026-02-24
 * Description : Unit tests for entity-type controller
 */

const EntityTypeController = require('@controllers/v1/entity-type')
const entityTypeService = require('@services/entity-type')

jest.mock('@services/entity-type')

describe('EntityType Controller', () => {
	let entityTypeController
	let mockRequest

	beforeEach(() => {
		entityTypeController = new EntityTypeController()
		mockRequest = {
			decodedToken: {
				id: 'user123',
				organization_id: 'orgId123',
				organization_code: 'org123',
				tenant_code: 'tenant123',
				roles: [{ title: 'admin' }],
			},
			body: {},
			params: {},
		}
		jest.clearAllMocks()
	})

	describe('create', () => {
		test('should create entity type successfully', async () => {
			mockRequest.body = {
				name: 'CustomEntity',
				fields: [{ name: 'field1', type: 'string' }],
			}
			const expectedResponse = {
				statusCode: 201,
				message: 'ENTITY_TYPE_CREATED_SUCCESSFULLY',
			}

			entityTypeService.create.mockResolvedValue(expectedResponse)

			const result = await entityTypeController.create(mockRequest)

			expect(entityTypeService.create).toHaveBeenCalledWith(
				mockRequest.body,
				'user123',
				'orgId123',
				'org123',
				'tenant123',
				mockRequest.decodedToken.roles
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during creation', async () => {
			const error = new Error('Creation failed')
			entityTypeService.create.mockRejectedValue(error)

			const result = await entityTypeController.create(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('update', () => {
		test('should update entity type successfully', async () => {
			mockRequest.params.id = 'entityType123'
			mockRequest.body = { name: 'UpdatedEntity' }
			const expectedResponse = {
				statusCode: 200,
				message: 'ENTITY_TYPE_UPDATED_SUCCESSFULLY',
			}

			entityTypeService.update.mockResolvedValue(expectedResponse)

			const result = await entityTypeController.update(mockRequest)

			expect(entityTypeService.update).toHaveBeenCalledWith(
				mockRequest.body,
				'entityType123',
				'user123',
				'org123',
				'tenant123',
				mockRequest.decodedToken.roles
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during update', async () => {
			mockRequest.params.id = 'entityType123'
			const error = new Error('Update failed')
			entityTypeService.update.mockRejectedValue(error)

			const result = await entityTypeController.update(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('read', () => {
		test('should read user entity types when value provided', async () => {
			mockRequest.body.value = 'CustomEntity'
			const expectedResponse = {
				statusCode: 200,
				result: { name: 'CustomEntity' },
			}

			entityTypeService.readUserEntityTypes.mockResolvedValue(expectedResponse)

			const result = await entityTypeController.read(mockRequest)

			expect(entityTypeService.readUserEntityTypes).toHaveBeenCalledWith(mockRequest.body, 'org123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should read all system entity types when no value', async () => {
			mockRequest.body.value = undefined
			const expectedResponse = {
				statusCode: 200,
				result: [{ name: 'Entity1' }, { name: 'Entity2' }],
			}

			entityTypeService.readAllSystemEntityTypes.mockResolvedValue(expectedResponse)

			const result = await entityTypeController.read(mockRequest)

			expect(entityTypeService.readAllSystemEntityTypes).toHaveBeenCalledWith('org123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during read', async () => {
			const error = new Error('Read failed')
			entityTypeService.readAllSystemEntityTypes.mockRejectedValue(error)

			const result = await entityTypeController.read(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('delete', () => {
		test('should delete entity types and entities by value', async () => {
			mockRequest.body.value = 'CustomEntity'
			const expectedResponse = {
				statusCode: 200,
				message: 'ENTITY_TYPE_DELETED_SUCCESSFULLY',
			}

			entityTypeService.deleteEntityTypesAndEntities.mockResolvedValue(expectedResponse)

			const result = await entityTypeController.delete(mockRequest)

			expect(entityTypeService.deleteEntityTypesAndEntities).toHaveBeenCalledWith('CustomEntity', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should delete entity type by id when no value', async () => {
			mockRequest.params.id = 'entityType123'
			mockRequest.body.value = undefined
			const expectedResponse = {
				statusCode: 200,
				message: 'ENTITY_TYPE_DELETED_SUCCESSFULLY',
			}

			entityTypeService.delete.mockResolvedValue(expectedResponse)

			const result = await entityTypeController.delete(mockRequest)

			expect(entityTypeService.delete).toHaveBeenCalledWith('entityType123', 'org123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during deletion', async () => {
			mockRequest.body.value = 'CustomEntity'
			const error = new Error('Deletion failed')
			entityTypeService.deleteEntityTypesAndEntities.mockRejectedValue(error)

			const result = await entityTypeController.delete(mockRequest)

			expect(result).toEqual(error)
		})
	})
})