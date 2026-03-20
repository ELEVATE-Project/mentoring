/**
 * name : notifications.spec.js
 * author : Test Author
 * created-date : 2026-02-24
 * Description : Unit tests for notifications controller
 */

const NotificationsController = require('@controllers/v1/notifications')
const notificationsService = require('@services/notifications')
const httpStatusCode = require('@generics/http-status')

jest.mock('@services/notifications')

describe('Notifications Controller', () => {
	let notificationsController
	let mockRequest

	beforeEach(() => {
		notificationsController = new NotificationsController()
		mockRequest = {
			body: {},
			decodedToken: null,
		}
		jest.clearAllMocks()
	})

	describe('emailCronJob', () => {
		test('should send email notification from cron job with body tenant_code', async () => {
			mockRequest.body = {
				job_id: 'job123',
				email_template_code: 'session_reminder',
				tenant_code: 'tenant123',
			}

			notificationsService.sendNotification.mockResolvedValue(undefined)

			const result = await notificationsController.emailCronJob(mockRequest)

			expect(notificationsService.sendNotification).toHaveBeenCalledWith('job123', 'session_reminder', '', 'tenant123')
			expect(result.statusCode).toBe(httpStatusCode.ok)
		})

		test('should send email notification with job_creator_org_id', async () => {
			mockRequest.body = {
				job_id: 'job123',
				email_template_code: 'mentor_reminder',
				job_creator_org_id: 'org456',
				tenant_code: 'tenant123',
			}

			notificationsService.sendNotification.mockResolvedValue(undefined)

			const result = await notificationsController.emailCronJob(mockRequest)

			expect(notificationsService.sendNotification).toHaveBeenCalledWith(
				'job123',
				'mentor_reminder',
				'org456',
				'tenant123'
			)
			expect(result.statusCode).toBe(httpStatusCode.ok)
		})

		test('should use tenant_code from decoded token when available', async () => {
			mockRequest.body = {
				job_id: 'job123',
				email_template_code: 'session_reminder',
			}
			mockRequest.decodedToken = {
				tenant_code: 'tokenTenant456',
			}

			notificationsService.sendNotification.mockResolvedValue(undefined)

			const result = await notificationsController.emailCronJob(mockRequest)

			expect(notificationsService.sendNotification).toHaveBeenCalledWith(
				'job123',
				'session_reminder',
				'',
				'tokenTenant456'
			)
			expect(result.statusCode).toBe(httpStatusCode.ok)
		})

		test('should prioritize body tenant_code over decoded token', async () => {
			mockRequest.body = {
				job_id: 'job123',
				email_template_code: 'session_reminder',
				tenant_code: 'bodyTenant123',
			}
			mockRequest.decodedToken = {
				tenant_code: 'tokenTenant456',
			}

			notificationsService.sendNotification.mockResolvedValue(undefined)

			const result = await notificationsController.emailCronJob(mockRequest)

			expect(notificationsService.sendNotification).toHaveBeenCalledWith(
				'job123',
				'session_reminder',
				'',
				'bodyTenant123'
			)
		})

		test('should return bad request when no tenant_code provided', async () => {
			mockRequest.body = {
				job_id: 'job123',
				email_template_code: 'session_reminder',
			}
			mockRequest.decodedToken = null

			const result = await notificationsController.emailCronJob(mockRequest)

			expect(notificationsService.sendNotification).not.toHaveBeenCalled()
			expect(result.statusCode).toBe(httpStatusCode.bad_request)
			expect(result.message).toBe('TENANT_CODE_REQUIRED')
		})

		test('should handle undefined decoded token gracefully', async () => {
			mockRequest.body = {
				job_id: 'job123',
				email_template_code: 'session_reminder',
			}
			mockRequest.decodedToken = undefined

			const result = await notificationsController.emailCronJob(mockRequest)

			expect(result.statusCode).toBe(httpStatusCode.bad_request)
			expect(result.message).toBe('TENANT_CODE_REQUIRED')
		})

		test('should handle error during notification sending', async () => {
			mockRequest.body = {
				job_id: 'job123',
				email_template_code: 'session_reminder',
				tenant_code: 'tenant123',
			}
			const error = new Error('Email sending failed')

			notificationsService.sendNotification.mockRejectedValue(error)

			const result = await notificationsController.emailCronJob(mockRequest)

			expect(result).toEqual(error)
		})

		test('should handle missing job_id', async () => {
			mockRequest.body = {
				email_template_code: 'session_reminder',
				tenant_code: 'tenant123',
			}

			notificationsService.sendNotification.mockResolvedValue(undefined)

			const result = await notificationsController.emailCronJob(mockRequest)

			expect(notificationsService.sendNotification).toHaveBeenCalledWith(
				undefined,
				'session_reminder',
				'',
				'tenant123'
			)
			expect(result.statusCode).toBe(httpStatusCode.ok)
		})

		test('should handle missing email_template_code', async () => {
			mockRequest.body = {
				job_id: 'job123',
				tenant_code: 'tenant123',
			}

			notificationsService.sendNotification.mockResolvedValue(undefined)

			const result = await notificationsController.emailCronJob(mockRequest)

			expect(notificationsService.sendNotification).toHaveBeenCalledWith('job123', undefined, '', 'tenant123')
			expect(result.statusCode).toBe(httpStatusCode.ok)
		})

		test('should call sendNotification asynchronously', async () => {
			mockRequest.body = {
				job_id: 'job123',
				email_template_code: 'session_reminder',
				tenant_code: 'tenant123',
			}

			const sendNotificationPromise = Promise.resolve()
			notificationsService.sendNotification.mockReturnValue(sendNotificationPromise)

			const result = await notificationsController.emailCronJob(mockRequest)

			expect(result.statusCode).toBe(httpStatusCode.ok)
			expect(notificationsService.sendNotification).toHaveBeenCalled()
		})
	})
})