/**
 * name : modules.spec.js
 * author : Test Author
 * created-date : 2026-02-24
 * Description : Unit tests for modules controller
 */

const ModulesController = require('@controllers/v1/modules')
const modulesService = require('@services/modules')

jest.mock('@services/modules')

describe('Modules Controller', () => {
	let modulesController
	let mockRequest

	beforeEach(() => {
		modulesController = new ModulesController()
		mockRequest = {
			decodedToken: {
				id: 'user123',
				organization_code: 'org123',
				tenant_code: 'tenant123',
			},
			body: {},
			params: {},
			pageNo: 1,
			pageSize: 10,
			searchText: '',
		}
		jest.clearAllMocks()
	})

	describe('create', () => {
		test('should create module successfully', async () => {
			mockRequest.body = {
				name: 'New Module',
				description: 'Module description',
				code: 'MODULE_001',
			}
			const expectedResponse = {
				statusCode: 201,
				message: 'MODULE_CREATED_SUCCESSFULLY',
			}

			modulesService.create.mockResolvedValue(expectedResponse)

			const result = await modulesController.create(mockRequest)

			expect(modulesService.create).toHaveBeenCalledWith(mockRequest.body, 'user123', 'org123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during module creation', async () => {
			mockRequest.body = { name: 'Module' }
			const error = new Error('Creation failed')
			modulesService.create.mockRejectedValue(error)

			const result = await modulesController.create(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('update', () => {
		test('should update module successfully', async () => {
			mockRequest.params.id = 'module123'
			mockRequest.body = {
				name: 'Updated Module',
				description: 'Updated description',
			}
			const expectedResponse = {
				statusCode: 200,
				message: 'MODULE_UPDATED_SUCCESSFULLY',
			}

			modulesService.update.mockResolvedValue(expectedResponse)

			const result = await modulesController.update(mockRequest)

			expect(modulesService.update).toHaveBeenCalledWith(
				'module123',
				mockRequest.body,
				'user123',
				'org123',
				'tenant123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during update', async () => {
			mockRequest.params.id = 'module123'
			mockRequest.body = { name: 'Updated' }
			const error = new Error('Update failed')
			modulesService.update.mockRejectedValue(error)

			const result = await modulesController.update(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('list', () => {
		test('should list modules with pagination', async () => {
			mockRequest.pageNo = 2
			mockRequest.pageSize = 20
			mockRequest.searchText = 'admin'
			const expectedResponse = {
				statusCode: 200,
				result: [
					{ id: 'module1', name: 'Admin Module' },
					{ id: 'module2', name: 'Admin Tools' },
				],
				count: 50,
			}

			modulesService.list.mockResolvedValue(expectedResponse)

			const result = await modulesController.list(mockRequest)

			expect(modulesService.list).toHaveBeenCalledWith(2, 20, 'admin', 'user123', 'org123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should list modules without search text', async () => {
			mockRequest.searchText = ''
			const expectedResponse = {
				statusCode: 200,
				result: [{ id: 'module1' }],
				count: 1,
			}

			modulesService.list.mockResolvedValue(expectedResponse)

			const result = await modulesController.list(mockRequest)

			expect(modulesService.list).toHaveBeenCalledWith(1, 10, '', 'user123', 'org123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle empty modules list', async () => {
			const expectedResponse = {
				statusCode: 200,
				result: [],
				count: 0,
			}

			modulesService.list.mockResolvedValue(expectedResponse)

			const result = await modulesController.list(mockRequest)

			expect(result.result).toEqual([])
			expect(result.count).toBe(0)
		})

		test('should handle error during list retrieval', async () => {
			const error = new Error('List failed')
			modulesService.list.mockRejectedValue(error)

			const result = await modulesController.list(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('delete', () => {
		test('should delete module successfully', async () => {
			mockRequest.params.id = 'module123'
			const expectedResponse = {
				statusCode: 200,
				message: 'MODULE_DELETED_SUCCESSFULLY',
			}

			modulesService.delete.mockResolvedValue(expectedResponse)

			const result = await modulesController.delete(mockRequest)

			expect(modulesService.delete).toHaveBeenCalledWith('module123', 'user123', 'org123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during deletion', async () => {
			mockRequest.params.id = 'module123'
			const error = new Error('Deletion failed')
			modulesService.delete.mockRejectedValue(error)

			const result = await modulesController.delete(mockRequest)

			expect(result).toEqual(error)
		})

		test('should handle deletion of non-existent module', async () => {
			mockRequest.params.id = 'nonexistent123'
			const error = new Error('Module not found')
			modulesService.delete.mockRejectedValue(error)

			const result = await modulesController.delete(mockRequest)

			expect(result).toEqual(error)
		})
	})
})