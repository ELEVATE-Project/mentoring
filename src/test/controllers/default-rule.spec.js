/**
 * name : default-rule.spec.js
 * author : Test Author
 * created-date : 2026-02-24
 * Description : Unit tests for default-rule controller
 */

const DefaultRuleController = require('@controllers/v1/default-rule')
const defaultRuleService = require('@services/default-rule')

jest.mock('@services/default-rule')

describe('DefaultRule Controller', () => {
	let defaultRuleController
	let mockRequest

	beforeEach(() => {
		defaultRuleController = new DefaultRuleController()
		mockRequest = {
			decodedToken: {
				id: 'user123',
				organization_id: 'orgId123',
				organization_code: 'org123',
				tenant_code: 'tenant123',
			},
			body: {},
			params: {},
		}
		jest.clearAllMocks()
	})

	describe('create', () => {
		test('should create default rule successfully', async () => {
			mockRequest.body = {
				type: 'session',
				rules: [{ field: 'category', operator: 'equals', value: 'tech' }],
			}
			const expectedResponse = {
				statusCode: 201,
				message: 'DEFAULT_RULE_CREATED_SUCCESSFULLY',
			}

			defaultRuleService.create.mockResolvedValue(expectedResponse)

			const result = await defaultRuleController.create(mockRequest)

			expect(defaultRuleService.create).toHaveBeenCalledWith(
				mockRequest.body,
				'user123',
				'orgId123',
				'org123',
				'tenant123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during rule creation', async () => {
			const error = new Error('Creation failed')
			defaultRuleService.create.mockRejectedValue(error)

			const result = await defaultRuleController.create(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('update', () => {
		test('should update default rule successfully', async () => {
			mockRequest.params.id = 'rule123'
			mockRequest.body = { rules: [{ field: 'status', operator: 'equals', value: 'active' }] }
			const expectedResponse = {
				statusCode: 200,
				message: 'DEFAULT_RULE_UPDATED_SUCCESSFULLY',
			}

			defaultRuleService.update.mockResolvedValue(expectedResponse)

			const result = await defaultRuleController.update(mockRequest)

			expect(defaultRuleService.update).toHaveBeenCalledWith(
				mockRequest.body,
				'rule123',
				'user123',
				'orgId123',
				'org123',
				'tenant123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during update', async () => {
			mockRequest.params.id = 'rule123'
			const error = new Error('Update failed')
			defaultRuleService.update.mockRejectedValue(error)

			const result = await defaultRuleController.update(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('read', () => {
		test('should read specific rule by id', async () => {
			mockRequest.params.id = 'rule123'
			const expectedResponse = {
				statusCode: 200,
				result: { id: 'rule123', type: 'session' },
			}

			defaultRuleService.readOne.mockResolvedValue(expectedResponse)

			const result = await defaultRuleController.read(mockRequest)

			expect(defaultRuleService.readOne).toHaveBeenCalledWith('rule123', 'org123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should read all rules when no id provided', async () => {
			mockRequest.params.id = undefined
			const expectedResponse = {
				statusCode: 200,
				result: [{ id: 'rule1' }, { id: 'rule2' }],
			}

			defaultRuleService.readAll.mockResolvedValue(expectedResponse)

			const result = await defaultRuleController.read(mockRequest)

			expect(defaultRuleService.readAll).toHaveBeenCalledWith('org123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during read', async () => {
			const error = new Error('Read failed')
			defaultRuleService.readAll.mockRejectedValue(error)

			const result = await defaultRuleController.read(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('delete', () => {
		test('should delete default rule successfully', async () => {
			mockRequest.params.id = 'rule123'
			const expectedResponse = {
				statusCode: 200,
				message: 'DEFAULT_RULE_DELETED_SUCCESSFULLY',
			}

			defaultRuleService.delete.mockResolvedValue(expectedResponse)

			const result = await defaultRuleController.delete(mockRequest)

			expect(defaultRuleService.delete).toHaveBeenCalledWith('rule123', 'org123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during deletion', async () => {
			mockRequest.params.id = 'rule123'
			const error = new Error('Deletion failed')
			defaultRuleService.delete.mockRejectedValue(error)

			const result = await defaultRuleController.delete(mockRequest)

			expect(result).toEqual(error)
		})
	})
})