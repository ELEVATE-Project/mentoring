/**
 * name : feedback.spec.js
 * author : Test Author
 * created-date : 2026-02-24
 * Description : Unit tests for feedback controller
 */

const FeedbackController = require('@controllers/v1/feedback')
const feedbackService = require('@services/feedback')
const common = require('@constants/common')
const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')

jest.mock('@services/feedback')
jest.mock('@helpers/responses')

describe('Feedback Controller', () => {
	let feedbackController
	let mockRequest

	beforeEach(() => {
		feedbackController = new FeedbackController()
		mockRequest = {
			decodedToken: {
				id: 'user123',
				roles: [{ title: 'mentee' }],
				tenant_code: 'tenant123',
				organization_code: 'org123',
			},
			params: {},
			body: {},
		}
		jest.clearAllMocks()
	})

	describe('forms', () => {
		test('should get feedback forms successfully', async () => {
			mockRequest.params.id = 'session123'
			const expectedResponse = {
				statusCode: 200,
				result: { formData: {} },
			}

			feedbackService.forms.mockResolvedValue(expectedResponse)

			const result = await feedbackController.forms(mockRequest)

			expect(feedbackService.forms).toHaveBeenCalledWith('session123', mockRequest.decodedToken.roles, 'tenant123', 'org123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error getting feedback forms', async () => {
			mockRequest.params.id = 'session123'
			const error = new Error('Form fetch failed')

			feedbackService.forms.mockRejectedValue(error)

			const result = await feedbackController.forms(mockRequest)

			expect(result).toEqual(error)
		})

		test('should work with mentor role', async () => {
			mockRequest.decodedToken.roles = [{ title: common.MENTOR_ROLE }]
			mockRequest.params.id = 'session123'
			const expectedResponse = {
				statusCode: 200,
				result: { formData: {} },
			}

			feedbackService.forms.mockResolvedValue(expectedResponse)

			const result = await feedbackController.forms(mockRequest)

			expect(feedbackService.forms).toHaveBeenCalled()
			expect(result).toEqual(expectedResponse)
		})
	})

	describe('submit', () => {
		test('should submit feedback successfully as mentee', async () => {
			mockRequest.params.id = 'session123'
			mockRequest.body = {
				rating: 5,
				comments: 'Great session',
			}
			const expectedResponse = {
				statusCode: 201,
				message: 'FEEDBACK_SUBMITTED_SUCCESSFULLY',
			}

			feedbackService.submit.mockResolvedValue(expectedResponse)

			const result = await feedbackController.submit(mockRequest)

			expect(feedbackService.submit).toHaveBeenCalledWith(
				'session123',
				mockRequest.body,
				'user123',
				false,
				'tenant123',
				'org123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should submit feedback as mentor with feedback_as field', async () => {
			mockRequest.decodedToken.roles = [{ title: common.MENTOR_ROLE }]
			mockRequest.params.id = 'session123'
			mockRequest.body = {
				feedback_as: 'mentor',
				rating: 4,
				comments: 'Good session',
			}
			const expectedResponse = {
				statusCode: 201,
				message: 'FEEDBACK_SUBMITTED_SUCCESSFULLY',
			}

			feedbackService.submit.mockResolvedValue(expectedResponse)

			const result = await feedbackController.submit(mockRequest)

			expect(feedbackService.submit).toHaveBeenCalledWith(
				'session123',
				mockRequest.body,
				'user123',
				true,
				'tenant123',
				'org123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should return error when mentor submits without feedback_as', async () => {
			mockRequest.decodedToken.roles = [{ title: common.MENTOR_ROLE }]
			mockRequest.params.id = 'session123'
			mockRequest.body = {
				rating: 4,
				comments: 'Good session',
			}

			responses.failureResponse.mockReturnValue({
				message: 'FEEDBACK_AS_NOT_PASSED',
				statusCode: httpStatusCode.unprocessable_entity,
				responseCode: 'CLIENT_ERROR',
			})

			const result = await feedbackController.submit(mockRequest)

			expect(responses.failureResponse).toHaveBeenCalledWith({
				message: 'FEEDBACK_AS_NOT_PASSED',
				statusCode: httpStatusCode.unprocessable_entity,
				responseCode: 'CLIENT_ERROR',
			})
			expect(feedbackService.submit).not.toHaveBeenCalled()
		})

		test('should handle error during feedback submission', async () => {
			mockRequest.params.id = 'session123'
			mockRequest.body = { rating: 5 }
			const error = new Error('Submission failed')

			feedbackService.submit.mockRejectedValue(error)

			const result = await feedbackController.submit(mockRequest)

			expect(result).toEqual(error)
		})

		test('should handle user with multiple roles including mentor', async () => {
			mockRequest.decodedToken.roles = [{ title: 'mentee' }, { title: common.MENTOR_ROLE }]
			mockRequest.params.id = 'session123'
			mockRequest.body = {
				feedback_as: 'mentee',
				rating: 5,
			}
			const expectedResponse = {
				statusCode: 201,
				message: 'FEEDBACK_SUBMITTED_SUCCESSFULLY',
			}

			feedbackService.submit.mockResolvedValue(expectedResponse)

			const result = await feedbackController.submit(mockRequest)

			expect(feedbackService.submit).toHaveBeenCalledWith(
				'session123',
				mockRequest.body,
				'user123',
				true,
				'tenant123',
				'org123'
			)
		})
	})
})