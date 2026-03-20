/**
 * name : cloud-services.spec.js
 * author : Test Author
 * created-date : 2026-02-24
 * Description : Unit tests for cloud-services controller
 */

const CloudServicesController = require('@controllers/v1/cloud-services')
const filesService = require('@services/files')

jest.mock('@services/files')

describe('CloudServices Controller', () => {
	let cloudServicesController
	let mockRequest

	beforeEach(() => {
		cloudServicesController = new CloudServicesController()
		mockRequest = {
			decodedToken: {
				id: 'user123',
				tenant_code: 'tenant123',
			},
			query: {},
		}
		jest.clearAllMocks()
	})

	describe('getSignedUrl', () => {
		test('should get signed URL successfully', async () => {
			mockRequest.query = {
				fileName: 'test-file.pdf',
			}
			const expectedResponse = {
				statusCode: 200,
				result: { signedUrl: 'https://example.com/signed-url' },
			}

			filesService.getSignedUrl.mockResolvedValue(expectedResponse)

			const result = await cloudServicesController.getSignedUrl(mockRequest)

			expect(filesService.getSignedUrl).toHaveBeenCalledWith('test-file.pdf', 'user123', '', false, 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should get signed URL with dynamic path', async () => {
			mockRequest.query = {
				fileName: 'document.pdf',
				dynamicPath: 'uploads/2026',
			}
			const expectedResponse = {
				statusCode: 200,
				result: { signedUrl: 'https://example.com/signed-url' },
			}

			filesService.getSignedUrl.mockResolvedValue(expectedResponse)

			const result = await cloudServicesController.getSignedUrl(mockRequest)

			expect(filesService.getSignedUrl).toHaveBeenCalledWith(
				'document.pdf',
				'user123',
				'uploads/2026',
				false,
				'tenant123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should get signed URL for public file', async () => {
			mockRequest.query = {
				fileName: 'public-file.pdf',
				public: 'true',
			}
			const expectedResponse = {
				statusCode: 200,
				result: { signedUrl: 'https://example.com/public-signed-url' },
			}

			filesService.getSignedUrl.mockResolvedValue(expectedResponse)

			const result = await cloudServicesController.getSignedUrl(mockRequest)

			expect(filesService.getSignedUrl).toHaveBeenCalledWith(
				'public-file.pdf',
				'user123',
				'',
				true,
				'tenant123'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should treat non-true public flag as false', async () => {
			mockRequest.query = {
				fileName: 'file.pdf',
				public: 'false',
			}
			const expectedResponse = {
				statusCode: 200,
				result: { signedUrl: 'https://example.com/signed-url' },
			}

			filesService.getSignedUrl.mockResolvedValue(expectedResponse)

			const result = await cloudServicesController.getSignedUrl(mockRequest)

			expect(filesService.getSignedUrl).toHaveBeenCalledWith('file.pdf', 'user123', '', false, 'tenant123')
		})

		test('should handle error during signed URL generation', async () => {
			mockRequest.query = { fileName: 'test.pdf' }
			const error = new Error('Signed URL generation failed')

			filesService.getSignedUrl.mockRejectedValue(error)

			const result = await cloudServicesController.getSignedUrl(mockRequest)

			expect(result).toEqual(error)
		})

		test('should handle missing fileName', async () => {
			mockRequest.query = {}
			const error = new Error('fileName is required')

			filesService.getSignedUrl.mockRejectedValue(error)

			const result = await cloudServicesController.getSignedUrl(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('getDownloadableUrl', () => {
		test('should get downloadable URL successfully', async () => {
			mockRequest.query = {
				filePath: 'documents/report.pdf',
			}
			const expectedResponse = {
				statusCode: 200,
				result: { downloadUrl: 'https://example.com/download-url' },
			}

			filesService.getDownloadableUrl.mockResolvedValue(expectedResponse)

			const result = await cloudServicesController.getDownloadableUrl(mockRequest)

			expect(filesService.getDownloadableUrl).toHaveBeenCalledWith('documents/report.pdf', false, 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should get downloadable URL for public file', async () => {
			mockRequest.query = {
				filePath: 'public/document.pdf',
				public: 'true',
			}
			const expectedResponse = {
				statusCode: 200,
				result: { downloadUrl: 'https://example.com/public-download-url' },
			}

			filesService.getDownloadableUrl.mockResolvedValue(expectedResponse)

			const result = await cloudServicesController.getDownloadableUrl(mockRequest)

			expect(filesService.getDownloadableUrl).toHaveBeenCalledWith('public/document.pdf', true, 'tenant123')
			expect(result).toEqual(expectedResponse)
		})

		test('should handle non-true public flag', async () => {
			mockRequest.query = {
				filePath: 'documents/file.pdf',
				public: 'no',
			}
			const expectedResponse = {
				statusCode: 200,
				result: { downloadUrl: 'https://example.com/download-url' },
			}

			filesService.getDownloadableUrl.mockResolvedValue(expectedResponse)

			const result = await cloudServicesController.getDownloadableUrl(mockRequest)

			expect(filesService.getDownloadableUrl).toHaveBeenCalledWith('documents/file.pdf', false, 'tenant123')
		})

		test('should handle error during downloadable URL generation', async () => {
			mockRequest.query = { filePath: 'documents/report.pdf' }
			const error = new Error('Download URL generation failed')

			filesService.getDownloadableUrl.mockRejectedValue(error)

			const result = await cloudServicesController.getDownloadableUrl(mockRequest)

			expect(result).toEqual(error)
		})

		test('should handle missing filePath', async () => {
			mockRequest.query = {}
			const error = new Error('filePath is required')

			filesService.getDownloadableUrl.mockRejectedValue(error)

			const result = await cloudServicesController.getDownloadableUrl(mockRequest)

			expect(result).toEqual(error)
		})

		test('should handle special characters in filePath', async () => {
			mockRequest.query = {
				filePath: 'documents/file with spaces.pdf',
			}
			const expectedResponse = {
				statusCode: 200,
				result: { downloadUrl: 'https://example.com/encoded-url' },
			}

			filesService.getDownloadableUrl.mockResolvedValue(expectedResponse)

			const result = await cloudServicesController.getDownloadableUrl(mockRequest)

			expect(filesService.getDownloadableUrl).toHaveBeenCalledWith(
				'documents/file with spaces.pdf',
				false,
				'tenant123'
			)
		})
	})
})