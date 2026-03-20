/**
 * name : issues.spec.js
 * author : Test Author
 * created-date : 2026-02-24
 * Description : Unit tests for issues controller
 */

const IssuesController = require('@controllers/v1/issues')
const issuesService = require('@services/issues')

jest.mock('@services/issues')

describe('Issues Controller', () => {
	let issuesController
	let mockRequest

	beforeEach(() => {
		issuesController = new IssuesController()
		mockRequest = {
			decodedToken: {
				id: 'user123',
				name: 'John Doe',
				email: 'john@example.com',
				tenant_code: 'tenant123',
			},
			body: {},
		}
		jest.clearAllMocks()
	})

	describe('create', () => {
		test('should create issue successfully', async () => {
			mockRequest.body = {
				description: 'Cannot log in to the system',
				category: 'authentication',
			}
			const expectedResponse = {
				statusCode: 201,
				message: 'ISSUE_REPORTED_SUCCESSFULLY',
			}

			issuesService.create.mockResolvedValue(expectedResponse)

			const result = await issuesController.create(mockRequest)

			expect(issuesService.create).toHaveBeenCalledWith(
				mockRequest.body,
				mockRequest.decodedToken,
				'tenant123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should handle detailed issue description', async () => {
			mockRequest.body = {
				description: 'Getting error 500 when trying to create a session. Steps to reproduce: 1. Login as mentor 2. Click create session 3. Fill form 4. Submit',
				category: 'sessions',
				priority: 'high',
			}
			const expectedResponse = {
				statusCode: 201,
				message: 'ISSUE_REPORTED_SUCCESSFULLY',
				result: { issueId: 'issue123' },
			}

			issuesService.create.mockResolvedValue(expectedResponse)

			const result = await issuesController.create(mockRequest)

			expect(issuesService.create).toHaveBeenCalledWith(
				mockRequest.body,
				mockRequest.decodedToken,
				'tenant123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during issue creation', async () => {
			mockRequest.body = {
				description: 'Issue description',
			}
			const error = new Error('Creation failed')

			issuesService.create.mockRejectedValue(error)

			const result = await issuesController.create(mockRequest)

			expect(result).toEqual(error)
		})

		test('should pass decoded token with user information', async () => {
			mockRequest.body = {
				description: 'Test issue',
			}
			const expectedResponse = {
				statusCode: 201,
				message: 'ISSUE_REPORTED_SUCCESSFULLY',
			}

			issuesService.create.mockResolvedValue(expectedResponse)

			await issuesController.create(mockRequest)

			expect(issuesService.create).toHaveBeenCalledWith(
				mockRequest.body,
				expect.objectContaining({
					id: 'user123',
					name: 'John Doe',
					email: 'john@example.com',
				}),
				'tenant123'
			)
		})

		test('should handle empty description', async () => {
			mockRequest.body = {
				description: '',
			}
			const error = new Error('Description is required')

			issuesService.create.mockRejectedValue(error)

			const result = await issuesController.create(mockRequest)

			expect(result).toEqual(error)
		})

		test('should handle missing body fields', async () => {
			mockRequest.body = {}
			const error = new Error('Required fields missing')

			issuesService.create.mockRejectedValue(error)

			const result = await issuesController.create(mockRequest)

			expect(result).toEqual(error)
		})
	})
})