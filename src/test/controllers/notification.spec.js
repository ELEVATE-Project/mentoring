/**
 * name : notification.spec.js
 * author : Test Author
 * created-date : 2026-02-24
 * Description : Unit tests for notification controller
 */

const NotificationController = require('@controllers/v1/notification')
const notificationService = require('@services/notification')
const utilsHelper = require('@generics/utils')
const common = require('@constants/common')
const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')

jest.mock('@services/notification')
jest.mock('@generics/utils')
jest.mock('@helpers/responses')

describe('Notification Controller', () => {
	let notificationController
	let mockRequest

	beforeEach(() => {
		notificationController = new NotificationController()
		mockRequest = {
			decodedToken: {
				id: 'user123',
				roles: [{ title: common.ADMIN_ROLE }],
				organization_code: 'org123',
				tenant_code: 'tenant123',
			},
			method: common.POST_METHOD,
			params: {},
			query: {},
			body: {},
		}
		utilsHelper.validateRoleAccess.mockReturnValue(true)
		jest.clearAllMocks()
	})

	describe('template - POST (create)', () => {
		test('should create notification template successfully', async () => {
			mockRequest.method = common.POST_METHOD
			mockRequest.body = {
				type: 'email',
				code: 'session_reminder',
				subject: 'Session Reminder',
				body: 'Your session starts soon',
			}
			const expectedResponse = {
				statusCode: 201,
				message: 'NOTIFICATION_TEMPLATE_CREATED_SUCCESSFULLY',
			}

			notificationService.create.mockResolvedValue(expectedResponse)

			const result = await notificationController.template(mockRequest)

			expect(notificationService.create).toHaveBeenCalledWith(mockRequest.body, mockRequest.decodedToken, 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should reject non-admin user creating template', async () => {
			utilsHelper.validateRoleAccess.mockReturnValue(false)
			mockRequest.method = common.POST_METHOD
			const errorResponse = {
				message: 'USER_IS_NOT_A_ADMIN',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			}

			responses.failureResponse.mockReturnValue(errorResponse)

			await expect(notificationController.template(mockRequest)).rejects.toEqual(errorResponse)
			expect(notificationService.create).not.toHaveBeenCalled()
		})

		test('should handle error during template creation', async () => {
			mockRequest.method = common.POST_METHOD
			const error = new Error('Creation failed')
			notificationService.create.mockRejectedValue(error)

			const result = await notificationController.template(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('template - PATCH (update)', () => {
		test('should update notification template successfully', async () => {
			mockRequest.method = common.PATCH_METHOD
			mockRequest.params.id = 'template123'
			mockRequest.body = {
				subject: 'Updated Subject',
			}
			const expectedResponse = {
				statusCode: 200,
				message: 'NOTIFICATION_TEMPLATE_UPDATED_SUCCESSFULLY',
			}

			notificationService.update.mockResolvedValue(expectedResponse)

			const result = await notificationController.template(mockRequest)

			expect(notificationService.update).toHaveBeenCalledWith(
				'template123',
				mockRequest.body,
				mockRequest.decodedToken,
				'tenant123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should reject non-admin user updating template', async () => {
			utilsHelper.validateRoleAccess.mockReturnValue(false)
			mockRequest.method = common.PATCH_METHOD
			mockRequest.params.id = 'template123'
			const errorResponse = {
				message: 'USER_IS_NOT_A_ADMIN',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			}

			responses.failureResponse.mockReturnValue(errorResponse)

			await expect(notificationController.template(mockRequest)).rejects.toEqual(errorResponse)
		})

		test('should handle error during template update', async () => {
			mockRequest.method = common.PATCH_METHOD
			mockRequest.params.id = 'template123'
			const error = new Error('Update failed')
			notificationService.update.mockRejectedValue(error)

			const result = await notificationController.template(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('template - GET (read)', () => {
		test('should read all notification templates', async () => {
			mockRequest.method = common.GET_METHOD
			mockRequest.params.id = undefined
			mockRequest.query.code = undefined
			const expectedResponse = {
				statusCode: 200,
				result: [{ id: 'template1' }, { id: 'template2' }],
			}

			notificationService.readAllNotificationTemplates.mockResolvedValue(expectedResponse)

			const result = await notificationController.template(mockRequest)

			expect(notificationService.readAllNotificationTemplates).toHaveBeenCalledWith('org123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should read specific template by id', async () => {
			mockRequest.method = common.GET_METHOD
			mockRequest.params.id = 'template123'
			const expectedResponse = {
				statusCode: 200,
				result: { id: 'template123', code: 'session_reminder' },
			}

			notificationService.read.mockResolvedValue(expectedResponse)

			const result = await notificationController.template(mockRequest)

			expect(notificationService.read).toHaveBeenCalledWith('template123', undefined, 'org123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should read template by code', async () => {
			mockRequest.method = common.GET_METHOD
			mockRequest.query.code = 'session_reminder'
			const expectedResponse = {
				statusCode: 200,
				result: { code: 'session_reminder', type: 'email' },
			}

			notificationService.read.mockResolvedValue(expectedResponse)

			const result = await notificationController.template(mockRequest)

			expect(notificationService.read).toHaveBeenCalledWith(undefined, 'session_reminder', 'org123', 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should reject non-admin user reading templates', async () => {
			utilsHelper.validateRoleAccess.mockReturnValue(false)
			mockRequest.method = common.GET_METHOD
			const errorResponse = {
				message: 'USER_IS_NOT_A_ADMIN',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			}

			responses.failureResponse.mockReturnValue(errorResponse)

			await expect(notificationController.template(mockRequest)).rejects.toEqual(errorResponse)
		})

		test('should handle error during template read', async () => {
			mockRequest.method = common.GET_METHOD
			const error = new Error('Read failed')
			notificationService.readAllNotificationTemplates.mockRejectedValue(error)

			const result = await notificationController.template(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('template - authorization checks', () => {
		test('should allow org_admin to access templates', async () => {
			mockRequest.decodedToken.roles = [{ title: common.ORG_ADMIN_ROLE }]
			utilsHelper.validateRoleAccess.mockReturnValue(true)
			mockRequest.method = common.GET_METHOD
			const expectedResponse = {
				statusCode: 200,
				result: [],
			}

			notificationService.readAllNotificationTemplates.mockResolvedValue(expectedResponse)

			const result = await notificationController.template(mockRequest)

			expect(utilsHelper.validateRoleAccess).toHaveBeenCalledWith(
				mockRequest.decodedToken.roles,
				[common.ADMIN_ROLE, common.ORG_ADMIN_ROLE]
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should reject mentor role', async () => {
			mockRequest.decodedToken.roles = [{ title: 'mentor' }]
			utilsHelper.validateRoleAccess.mockReturnValue(false)
			const errorResponse = {
				message: 'USER_IS_NOT_A_ADMIN',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			}

			responses.failureResponse.mockReturnValue(errorResponse)

			await expect(notificationController.template(mockRequest)).rejects.toEqual(errorResponse)
		})
	})
})