/**
 * name : admin.spec.js
 * author : Test Author
 * created-date : 2026-02-24
 * Description : Unit tests for admin controller
 */

const AdminController = require('@controllers/v1/admin')
const adminService = require('@services/admin')
const responses = require('@helpers/responses')
const httpStatusCode = require('@generics/http-status')
const common = require('@constants/common')
const userExtensionQueries = require('@database/queries/userExtension')

jest.mock('@services/admin')
jest.mock('@helpers/responses')
jest.mock('@database/queries/userExtension')

describe('Admin Controller', () => {
	let adminController
	let mockRequest
	let mockDecodedToken

	beforeEach(() => {
		adminController = new AdminController()
		mockDecodedToken = {
			id: 'user123',
			organization_code: 'org123',
			organization_id: 'orgId123',
			tenant_code: 'tenant123',
			roles: [{ title: common.ADMIN_ROLE }],
		}
		mockRequest = {
			decodedToken: mockDecodedToken,
			query: {},
			params: {},
			body: {},
		}
		jest.clearAllMocks()
	})

	describe('userDelete', () => {
		test('should successfully delete user when caller is admin', async () => {
			mockRequest.query.userId = 'userToDelete123'
			const expectedResponse = {
				statusCode: 200,
				message: 'USER_DELETED_SUCCESSFULLY',
			}

			adminService.userDelete.mockResolvedValue(expectedResponse)

			const result = await adminController.userDelete(mockRequest)

			expect(adminService.userDelete).toHaveBeenCalledWith(
				'userToDelete123',
				'user123',
				'org123',
				'tenant123',
				'',
				true
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should delete user when caller is not admin', async () => {
			mockRequest.decodedToken.roles = [{ title: 'user' }]
			mockRequest.query.userId = 'userToDelete123'
			const expectedResponse = {
				statusCode: 200,
				message: 'USER_DELETED_SUCCESSFULLY',
			}

			adminService.userDelete.mockResolvedValue(expectedResponse)

			const result = await adminController.userDelete(mockRequest)

			expect(adminService.userDelete).toHaveBeenCalledWith(
				'userToDelete123',
				'user123',
				'org123',
				'tenant123',
				'',
				false
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error during user deletion', async () => {
			mockRequest.query.userId = 'userToDelete123'
			const error = new Error('Database error')
			adminService.userDelete.mockRejectedValue(error)

			responses.failureResponse.mockReturnValue({
				statusCode: httpStatusCode.internal_server_error,
				message: 'USER_DELETION_FAILED',
				responseCode: 'SERVER_ERROR',
			})

			const result = await adminController.userDelete(mockRequest)

			expect(result.statusCode).toBe(httpStatusCode.internal_server_error)
			expect(result.message).toBe('USER_DELETION_FAILED')
		})

		test('should handle missing roles in token', async () => {
			mockRequest.decodedToken.roles = undefined
			mockRequest.query.userId = 'userToDelete123'
			const expectedResponse = {
				statusCode: 200,
				message: 'USER_DELETED_SUCCESSFULLY',
			}

			adminService.userDelete.mockResolvedValue(expectedResponse)

			const result = await adminController.userDelete(mockRequest)

			expect(adminService.userDelete).toHaveBeenCalledWith(
				'userToDelete123',
				'user123',
				'org123',
				'tenant123',
				'',
				false
			)
		})
	})

	describe('triggerViewRebuild', () => {
		test('should trigger view rebuild when user is admin', async () => {
			const expectedResponse = {
				statusCode: 200,
				message: 'VIEW_REBUILD_TRIGGERED',
			}

			adminService.triggerViewRebuild.mockResolvedValue(expectedResponse)

			const result = await adminController.triggerViewRebuild(mockRequest)

			expect(adminService.triggerViewRebuild).toHaveBeenCalled()
			expect(result).toEqual(expectedResponse)
		})

		test('should return unauthorized when user is not admin', async () => {
			mockRequest.decodedToken.roles = [{ title: 'user' }]

			responses.failureResponse.mockReturnValue({
				message: 'UNAUTHORIZED_REQUEST',
				statusCode: httpStatusCode.unauthorized,
				responseCode: 'UNAUTHORIZED',
			})

			const result = await adminController.triggerViewRebuild(mockRequest)

			expect(adminService.triggerViewRebuild).not.toHaveBeenCalled()
			expect(responses.failureResponse).toHaveBeenCalledWith({
				message: 'UNAUTHORIZED_REQUEST',
				statusCode: httpStatusCode.unauthorized,
				responseCode: 'UNAUTHORIZED',
			})
		})

		test('should handle error during view rebuild', async () => {
			const error = new Error('Rebuild failed')
			adminService.triggerViewRebuild.mockRejectedValue(error)

			const result = await adminController.triggerViewRebuild(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('triggerPeriodicViewRefresh', () => {
		test('should trigger periodic view refresh for specific tenant', async () => {
			mockRequest.query.tenant_code = 'tenant456'
			mockRequest.query.model_name = 'Session'
			const expectedResponse = {
				statusCode: 200,
				message: 'VIEW_REFRESH_TRIGGERED',
			}

			adminService.triggerPeriodicViewRefresh.mockResolvedValue(expectedResponse)

			const result = await adminController.triggerPeriodicViewRefresh(mockRequest)

			expect(adminService.triggerPeriodicViewRefresh).toHaveBeenCalledWith(
				mockDecodedToken,
				'tenant456',
				'Session'
			)
			expect(result).toEqual(expectedResponse)
		})

		test('should trigger refresh without tenant code', async () => {
			mockRequest.query.model_name = 'Session'
			const expectedResponse = {
				statusCode: 200,
				message: 'VIEW_REFRESH_TRIGGERED',
			}

			adminService.triggerPeriodicViewRefresh.mockResolvedValue(expectedResponse)

			const result = await adminController.triggerPeriodicViewRefresh(mockRequest)

			expect(adminService.triggerPeriodicViewRefresh).toHaveBeenCalledWith(mockDecodedToken, null, 'Session')
		})

		test('should return unauthorized when user is not admin', async () => {
			mockRequest.decodedToken.roles = [{ title: 'mentor' }]

			responses.failureResponse.mockReturnValue({
				message: 'UNAUTHORIZED_REQUEST',
				statusCode: httpStatusCode.unauthorized,
				responseCode: 'UNAUTHORIZED',
			})

			const result = await adminController.triggerPeriodicViewRefresh(mockRequest)

			expect(adminService.triggerPeriodicViewRefresh).not.toHaveBeenCalled()
		})
	})

	describe('triggerViewRebuildInternal', () => {
		test('should trigger internal view rebuild', async () => {
			const expectedResponse = {
				statusCode: 200,
				message: 'VIEW_REBUILD_TRIGGERED',
			}

			adminService.triggerViewRebuild.mockResolvedValue(expectedResponse)

			const result = await adminController.triggerViewRebuildInternal(mockRequest)

			expect(adminService.triggerViewRebuild).toHaveBeenCalled()
			expect(result).toEqual(expectedResponse)
		})

		test('should handle error in internal rebuild', async () => {
			const error = new Error('Internal rebuild failed')
			adminService.triggerViewRebuild.mockRejectedValue(error)

			const result = await adminController.triggerViewRebuildInternal(mockRequest)

			expect(result).toEqual(error)
		})
	})

	describe('triggerPeriodicViewRefreshInternal', () => {
		test('should refresh view for specific tenant when id param provided', async () => {
			mockRequest.params.id = 'tenant456|Session'
			const expectedResponse = {
				statusCode: 200,
				message: 'VIEW_REFRESHED',
			}

			adminService.triggerPeriodicViewRefreshInternal.mockResolvedValue(expectedResponse)

			const result = await adminController.triggerPeriodicViewRefreshInternal(mockRequest)

			expect(adminService.triggerPeriodicViewRefreshInternal).toHaveBeenCalledWith('Session', 'tenant456')
			expect(result).toEqual(expectedResponse)
		})

		test('should refresh views for all tenants when no id param', async () => {
			mockRequest.params.id = undefined
			const mockTenants = [{ code: 'tenant1' }, { code: 'tenant2' }]
			const serviceResponse = {
				statusCode: 200,
				result: { refreshed: true },
			}

			userExtensionQueries.getDistinctTenantCodes.mockResolvedValue(mockTenants)
			adminService.triggerPeriodicViewRefreshInternal.mockResolvedValue(serviceResponse)
			responses.successResponse.mockReturnValue({
				statusCode: 200,
				message: 'MATERIALIZED_VIEW_REFRESH_INITIATED_SUCCESSFULLY',
			})

			const result = await adminController.triggerPeriodicViewRefreshInternal(mockRequest)

			expect(userExtensionQueries.getDistinctTenantCodes).toHaveBeenCalled()
			expect(adminService.triggerPeriodicViewRefreshInternal).toHaveBeenCalledTimes(2)
			expect(responses.successResponse).toHaveBeenCalled()
		})

		test('should skip undefined tenant codes', async () => {
			mockRequest.params.id = undefined
			const mockTenants = [{ code: 'tenant1' }, { code: 'undefined' }, { code: 'tenant2' }]
			const serviceResponse = {
				statusCode: 200,
				result: { refreshed: true },
			}

			userExtensionQueries.getDistinctTenantCodes.mockResolvedValue(mockTenants)
			adminService.triggerPeriodicViewRefreshInternal.mockResolvedValue(serviceResponse)
			responses.successResponse.mockReturnValue({
				statusCode: 200,
				message: 'MATERIALIZED_VIEW_REFRESH_INITIATED_SUCCESSFULLY',
			})

			await adminController.triggerPeriodicViewRefreshInternal(mockRequest)

			expect(adminService.triggerPeriodicViewRefreshInternal).toHaveBeenCalledTimes(2)
		})

		test('should handle no tenants found', async () => {
			mockRequest.params.id = undefined
			userExtensionQueries.getDistinctTenantCodes.mockResolvedValue([])

			responses.successResponse.mockReturnValue({
				statusCode: 200,
				message: 'NO_TENANTS_FOUND',
			})

			const result = await adminController.triggerPeriodicViewRefreshInternal(mockRequest)

			expect(responses.successResponse).toHaveBeenCalledWith({
				statusCode: 200,
				message: 'NO_TENANTS_FOUND',
				result: { tenantsProcessed: 0 },
			})
		})

		test('should handle errors during tenant processing', async () => {
			mockRequest.params.id = undefined
			const mockTenants = [{ code: 'tenant1' }]
			const error = new Error('Processing error')

			userExtensionQueries.getDistinctTenantCodes.mockResolvedValue(mockTenants)
			adminService.triggerPeriodicViewRefreshInternal.mockRejectedValue(error)
			responses.successResponse.mockReturnValue({
				statusCode: 200,
				message: 'MATERIALIZED_VIEW_REFRESH_INITIATED_SUCCESSFULLY',
			})

			await adminController.triggerPeriodicViewRefreshInternal(mockRequest)

			expect(responses.successResponse).toHaveBeenCalled()
		})

		test('should handle top-level error', async () => {
			const error = new Error('Top level error')
			userExtensionQueries.getDistinctTenantCodes.mockRejectedValue(error)

			responses.failureResponse.mockReturnValue({
				statusCode: 500,
				message: 'MATERIALIZED_VIEW_REFRESH_FAILED',
			})

			const result = await adminController.triggerPeriodicViewRefreshInternal(mockRequest)

			expect(responses.failureResponse).toHaveBeenCalled()
		})
	})

	describe('getCacheStats', () => {
		test('should return cache statistics for admin', async () => {
			const expectedStats = {
				statusCode: 200,
				result: { hits: 100, misses: 10 },
			}

			adminService.getCacheStatistics.mockResolvedValue(expectedStats)

			const result = await adminController.getCacheStats(mockRequest)

			expect(adminService.getCacheStatistics).toHaveBeenCalledWith('tenant123', 'orgId123')
			expect(result).toEqual(expectedStats)
		})

		test('should return unauthorized for non-admin', async () => {
			mockRequest.decodedToken.roles = [{ title: 'user' }]

			responses.failureResponse.mockReturnValue({
				message: 'UNAUTHORIZED_REQUEST',
				statusCode: httpStatusCode.unauthorized,
				responseCode: 'UNAUTHORIZED',
			})

			const result = await adminController.getCacheStats(mockRequest)

			expect(adminService.getCacheStatistics).not.toHaveBeenCalled()
		})

		test('should handle error getting cache stats', async () => {
			const error = new Error('Cache error')
			adminService.getCacheStatistics.mockRejectedValue(error)

			responses.failureResponse.mockReturnValue({
				statusCode: 500,
				message: 'CACHE_STATS_FETCH_FAILED',
			})

			const result = await adminController.getCacheStats(mockRequest)

			expect(result.statusCode).toBe(500)
		})
	})

	describe('clearCache', () => {
		test('should clear cache for specific namespace', async () => {
			mockRequest.query.namespace = 'sessions'
			const expectedResponse = {
				statusCode: 200,
				message: 'CACHE_CLEARED',
			}

			adminService.clearCache.mockResolvedValue(expectedResponse)

			const result = await adminController.clearCache(mockRequest)

			expect(adminService.clearCache).toHaveBeenCalledWith({
				namespace: 'sessions',
				tenantCode: 'tenant123',
				orgId: 'orgId123',
				adminTenantCode: 'tenant123',
				adminOrgId: 'orgId123',
			})
			expect(result).toEqual(expectedResponse)
		})

		test('should clear cache with custom tenant and org', async () => {
			mockRequest.query.namespace = 'sessions'
			mockRequest.query.tenantCode = 'customTenant'
			mockRequest.query.orgId = 'customOrg'
			const expectedResponse = {
				statusCode: 200,
				message: 'CACHE_CLEARED',
			}

			adminService.clearCache.mockResolvedValue(expectedResponse)

			const result = await adminController.clearCache(mockRequest)

			expect(adminService.clearCache).toHaveBeenCalledWith({
				namespace: 'sessions',
				tenantCode: 'customTenant',
				orgId: 'customOrg',
				adminTenantCode: 'tenant123',
				adminOrgId: 'orgId123',
			})
		})

		test('should return unauthorized for non-admin', async () => {
			mockRequest.decodedToken.roles = [{ title: 'mentor' }]

			responses.failureResponse.mockReturnValue({
				message: 'UNAUTHORIZED_REQUEST',
				statusCode: httpStatusCode.unauthorized,
				responseCode: 'UNAUTHORIZED',
			})

			const result = await adminController.clearCache(mockRequest)

			expect(adminService.clearCache).not.toHaveBeenCalled()
		})

		test('should handle error clearing cache', async () => {
			mockRequest.query.namespace = 'sessions'
			const error = new Error('Clear failed')
			adminService.clearCache.mockRejectedValue(error)

			responses.failureResponse.mockReturnValue({
				statusCode: 500,
				message: 'CACHE_CLEAR_FAILED',
			})

			const result = await adminController.clearCache(mockRequest)

			expect(result.statusCode).toBe(500)
		})
	})

	describe('warmUpCache', () => {
		test('should warm up cache with default tenant and org', async () => {
			const expectedResponse = {
				statusCode: 200,
				message: 'CACHE_WARMED_UP',
			}

			mockRequest.decodedToken.org = 'orgId123'
			adminService.warmUpCache.mockResolvedValue(expectedResponse)

			const result = await adminController.warmUpCache(mockRequest)

			expect(adminService.warmUpCache).toHaveBeenCalledWith({
				tenantCode: 'tenant123',
				orgCode: 'org123',
				adminTenantCode: 'tenant123',
				adminOrgCode: 'org123',
			})
			expect(result).toEqual(expectedResponse)
		})

		test('should warm up cache with custom tenant and org', async () => {
			mockRequest.query.tenantCode = 'customTenant'
			mockRequest.query.orgCode = 'customOrg'
			const expectedResponse = {
				statusCode: 200,
				message: 'CACHE_WARMED_UP',
			}

			adminService.warmUpCache.mockResolvedValue(expectedResponse)

			const result = await adminController.warmUpCache(mockRequest)

			expect(adminService.warmUpCache).toHaveBeenCalledWith({
				tenantCode: 'customTenant',
				orgCode: 'customOrg',
				adminTenantCode: 'tenant123',
				adminOrgCode: 'org123',
			})
		})

		test('should return unauthorized for non-admin', async () => {
			mockRequest.decodedToken.roles = [{ title: 'user' }]

			responses.failureResponse.mockReturnValue({
				message: 'UNAUTHORIZED_REQUEST',
				statusCode: httpStatusCode.unauthorized,
				responseCode: 'UNAUTHORIZED',
			})

			const result = await adminController.warmUpCache(mockRequest)

			expect(adminService.warmUpCache).not.toHaveBeenCalled()
		})

		test('should handle error warming up cache', async () => {
			const error = new Error('Warmup failed')
			adminService.warmUpCache.mockRejectedValue(error)

			responses.failureResponse.mockReturnValue({
				statusCode: 500,
				message: 'CACHE_WARMUP_FAILED',
			})

			const result = await adminController.warmUpCache(mockRequest)

			expect(result.statusCode).toBe(500)
		})
	})

	describe('getCacheHealth', () => {
		test('should return cache health for admin', async () => {
			const expectedHealth = {
				statusCode: 200,
				result: { status: 'healthy' },
			}

			adminService.getCacheHealth.mockResolvedValue(expectedHealth)

			const result = await adminController.getCacheHealth(mockRequest)

			expect(adminService.getCacheHealth).toHaveBeenCalled()
			expect(result).toEqual(expectedHealth)
		})

		test('should return unauthorized for non-admin', async () => {
			mockRequest.decodedToken.roles = [{ title: 'mentee' }]

			responses.failureResponse.mockReturnValue({
				message: 'UNAUTHORIZED_REQUEST',
				statusCode: httpStatusCode.unauthorized,
				responseCode: 'UNAUTHORIZED',
			})

			const result = await adminController.getCacheHealth(mockRequest)

			expect(adminService.getCacheHealth).not.toHaveBeenCalled()
		})

		test('should handle error getting cache health', async () => {
			const error = new Error('Health check failed')
			adminService.getCacheHealth.mockRejectedValue(error)

			responses.failureResponse.mockReturnValue({
				statusCode: 500,
				message: 'CACHE_HEALTH_CHECK_FAILED',
			})

			const result = await adminController.getCacheHealth(mockRequest)

			expect(result.statusCode).toBe(500)
		})
	})
})