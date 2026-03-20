/**
 * name : form.spec.js
 * author : Test Author
 * created-date : 2026-02-24
 * Description : Unit tests for form controller
 */

const FormController = require('@controllers/v1/form')
const formsService = require('@services/form')

jest.mock('@services/form')

describe('Form Controller', () => {
	let formController
	let mockRequest

	beforeEach(() => {
		formController = new FormController()
		mockRequest = {
			decodedToken: {
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
		test('should create form successfully', async () => {
			mockRequest.body = {
				type: 'session_feedback',
				fields: [{ name: 'rating', type: 'number' }],
			}
			const expectedResponse = {
				statusCode: 201,
				message: 'FORM_CREATED_SUCCESSFULLY',
			}

			formsService.create.mockResolvedValue(expectedResponse)

			const result = await formController.create(mockRequest)

			expect(formsService.create).toHaveBeenCalledWith(mockRequest.body, 'orgId123', 'org123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during form creation', async () => {
			const error = new Error('Creation failed')
			formsService.create.mockRejectedValue(error)

			const result = await formController.create(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('update', () => {
		test('should update form successfully', async () => {
			mockRequest.params.id = 'form123'
			mockRequest.body = {
				fields: [{ name: 'comments', type: 'text' }],
			}
			const expectedResponse = {
				statusCode: 200,
				message: 'FORM_UPDATED_SUCCESSFULLY',
			}

			formsService.update.mockResolvedValue(expectedResponse)

			const result = await formController.update(mockRequest)

			expect(formsService.update).toHaveBeenCalledWith('form123', mockRequest.body, 'org123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during update', async () => {
			mockRequest.params.id = 'form123'
			const error = new Error('Update failed')
			formsService.update.mockRejectedValue(error)

			const result = await formController.update(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('read', () => {
		test('should read all forms versions when no id and empty body', async () => {
			mockRequest.params.id = undefined
			mockRequest.body = {}
			const expectedResponse = {
				statusCode: 200,
				result: [{ version: 1 }, { version: 2 }],
			}

			formsService.readAllFormsVersion.mockResolvedValue(expectedResponse)

			const result = await formController.read(mockRequest)

			expect(formsService.readAllFormsVersion).toHaveBeenCalledWith('tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should read specific form by id', async () => {
			mockRequest.params.id = 'form123'
			mockRequest.body = {}
			const expectedResponse = {
				statusCode: 200,
				result: { id: 'form123', type: 'feedback' },
			}

			formsService.read.mockResolvedValue(expectedResponse)

			const result = await formController.read(mockRequest)

			expect(formsService.read).toHaveBeenCalledWith('form123', {}, 'org123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should read form with body filters', async () => {
			mockRequest.params.id = undefined
			mockRequest.body = { type: 'session_feedback' }
			const expectedResponse = {
				statusCode: 200,
				result: { id: 'form456', type: 'session_feedback' },
			}

			formsService.read.mockResolvedValue(expectedResponse)

			const result = await formController.read(mockRequest)

			expect(formsService.read).toHaveBeenCalledWith(
				undefined,
				{ type: 'session_feedback' },
				'org123',
				'tenant123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during read', async () => {
			const error = new Error('Read failed')
			formsService.readAllFormsVersion.mockRejectedValue(error)

			const result = await formController.read(mockRequest)

			expect(result).toEqual(error)
		})

		test('should handle Object.keys check for empty body correctly', async () => {
			mockRequest.params.id = undefined
			mockRequest.body = { field: 'value' }
			const expectedResponse = {
				statusCode: 200,
				result: {},
			}

			formsService.read.mockResolvedValue(expectedResponse)

			const result = await formController.read(mockRequest)

			expect(formsService.read).toHaveBeenCalled()
			expect(formsService.readAllFormsVersion).not.toHaveBeenCalled()
		})
	})
})