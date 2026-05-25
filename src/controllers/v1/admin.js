/**
 * name : admin.js
 * author : Nevil Mathew
 * created-date : 21-JUN-2023
 * Description : Admin Controller.
 */

// Dependencies
const adminService = require('@services/admin')
const common = require('@constants/common')
const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')
const cacheHelper = require('@generics/cacheHelper')
const userExtensionQueries = require('@database/queries/userExtension')

module.exports = class admin {
	/**
	 * userDelete
	 * @method
	 * @name userDelete
	 * @param {Object} req -request data.
	 * @param {String} req.query.userId - User Id.
	 * @returns {JSON} - Success Response.
	 */

	async userDelete(req) {
		try {
			// Check if the caller is an admin (allows cross-tenant deletions)
			const isAdmin = req.decodedToken.roles?.some((role) => role.title === common.ADMIN_ROLE) || false

			const userDelete = await adminService.userDelete(
				req.query.userId,
				req.decodedToken.id,
				req.decodedToken.organization_code,
				req.decodedToken.tenant_code,
				'',
				isAdmin
			)
			return userDelete
		} catch (error) {
			console.error('Controller error in userDelete:', error)
			return responses.failureResponse({
				statusCode: httpStatusCode.internal_server_error,
				message: 'USER_DELETION_FAILED',
				responseCode: 'SERVER_ERROR',
			})
		}
	}

	async triggerViewRebuild(req) {
		try {
			if (!req.decodedToken.roles.some((role) => role.title === common.ADMIN_ROLE)) {
				return responses.failureResponse({
					message: 'UNAUTHORIZED_REQUEST',
					statusCode: httpStatusCode.unauthorized,
					responseCode: 'UNAUTHORIZED',
				})
			}
			// Build operation: ALWAYS build for ALL tenants - no parameters needed
			const result = await adminService.triggerViewRebuild()
			return result
		} catch (error) {
			return error
		}
	}
	async triggerPeriodicViewRefresh(req) {
		try {
			if (!req.decodedToken.roles.some((role) => role.title === common.ADMIN_ROLE)) {
				return responses.failureResponse({
					message: 'UNAUTHORIZED_REQUEST',
					statusCode: httpStatusCode.unauthorized,
					responseCode: 'UNAUTHORIZED',
				})
			}
			// Extract model_name and tenant_code from query parameters
			const tenantCode = req.query.tenant_code || null
			return await adminService.triggerPeriodicViewRefresh(req.decodedToken, tenantCode, req.query.model_name)
		} catch (err) {
			console.log(err)
		}
	}
	async triggerViewRebuildInternal(req) {
		try {
			// Internal method - builds ALL materialized views for ALL tenants
			// No parameters needed - always builds everything
			// Ignore any query parameters - build is always for all tenants
			return await adminService.triggerViewRebuild()
		} catch (error) {
			return error
		}
	}
	async triggerPeriodicViewRefreshInternal(req) {
		try {
			// Internal method - can refresh for specific tenant or all tenants
			let tenantCode = null
			let modelName = null

			// Check if tenant_code and model_name are encoded in path parameter (id)
			// Format: {tenantCode|modelName} - Express auto-decodes URL params
			if (req.params.id) {
				const parts = req.params.id.split('|')
				if (parts.length === 2) {
					tenantCode = parts[0]
					modelName = parts[1]
				}
			}

			// If tenantCode is provided, refresh for that specific tenant
			if (tenantCode) {
				return await adminService.triggerPeriodicViewRefreshInternal(modelName, tenantCode)
			} else {
				// If no tenantCode provided, fetch all tenants dynamically and refresh for each
				const tenants = await userExtensionQueries.getDistinctTenantCodes()
				if (!tenants || tenants.length === 0) {
					return responses.successResponse({
						statusCode: httpStatusCode.ok,
						message: 'NO_TENANTS_FOUND',
						result: { tenantsProcessed: 0 },
					})
				}

				// Process each tenant
				const results = []
				for (const tenant of tenants) {
					const tenantCodeToProcess = tenant.code
					// Skip invalid tenant codes
					if (!tenantCodeToProcess || tenantCodeToProcess === 'undefined') {
						continue
					}
					try {
						const result = await adminService.triggerPeriodicViewRefreshInternal(
							modelName,
							tenantCodeToProcess
						)
						results.push({
							tenantCode: tenantCodeToProcess,
							modelName: modelName || 'all models',
							success: result.statusCode === httpStatusCode.ok,
							result: result.result,
						})
					} catch (error) {
						results.push({
							tenantCode: tenantCodeToProcess,
							modelName: modelName || 'all models',
							success: false,
							error: error.message || 'Unknown error',
						})
					}
				}
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'MATERIALIZED_VIEW_REFRESH_INITIATED_SUCCESSFULLY',
					result: {
						tenantsProcessed: results.length,
						results: results,
					},
				})
			}
		} catch (err) {
			console.error('❌ Error in triggerPeriodicViewRefreshInternal:', err)
			return responses.failureResponse({
				statusCode: httpStatusCode.internal_server_error,
				message: 'MATERIALIZED_VIEW_REFRESH_FAILED',
				responseCode: 'SERVER_ERROR',
			})
		}
	}

	//Session Manager Deletion Flow Codes

	// async assignNewSessionManager(req) {
	// 	try {
	// 		const assignNewSessionManager = await adminService.assignNewSessionManager(req.decodedToken, req.query.oldSessionManagerId, req.query.newSessionManagerId, req.query.orgAdminUserId)
	// 		return assignNewSessionManager
	// 	} catch (error) {
	// 		return error
	// 	}
	// }

	/**
	 * Cache Administration APIs
	 */

	/**
	 * Get cache statistics and monitoring info
	 * @method
	 * @name getCacheStats
	 * @param {Object} req - request data
	 * @returns {JSON} - Cache statistics response
	 */
	async getCacheStats(req) {
		try {
			if (!req.decodedToken.roles.some((role) => role.title === common.ADMIN_ROLE)) {
				return responses.failureResponse({
					message: 'UNAUTHORIZED_REQUEST',
					statusCode: httpStatusCode.unauthorized,
					responseCode: 'UNAUTHORIZED',
				})
			}

			const tenantCode = req.decodedToken.tenant_code
			const organizationId = req.decodedToken.organization_id

			return await adminService.getCacheStatistics(tenantCode, organizationId)
		} catch (error) {
			console.error('Controller error in getCacheStats:', error)
			return responses.failureResponse({
				statusCode: httpStatusCode.internal_server_error,
				message: 'CACHE_STATS_FETCH_FAILED',
				responseCode: 'SERVER_ERROR',
			})
		}
	}

	/**
	 * Clear cache for specific namespace or tenant
	 * @method
	 * @name clearCache
	 * @param {Object} req - request data
	 * @param {String} req.query.namespace - Namespace to clear (optional)
	 * @param {String} req.query.tenantCode - Tenant code to clear (optional)
	 * @param {String} req.query.orgId - Organization ID to clear (optional)
	 * @returns {JSON} - Cache clear response
	 */
	async clearCache(req) {
		try {
			if (!req.decodedToken.roles.some((role) => role.title === common.ADMIN_ROLE)) {
				return responses.failureResponse({
					message: 'UNAUTHORIZED_REQUEST',
					statusCode: httpStatusCode.unauthorized,
					responseCode: 'UNAUTHORIZED',
				})
			}

			const { namespace, tenantCode, orgId } = req.query
			const adminTenantCode = req.decodedToken.tenant_code
			const adminOrgId = req.decodedToken.organization_id

			return await adminService.clearCache({
				namespace,
				tenantCode: tenantCode || adminTenantCode,
				orgId: orgId || adminOrgId,
				adminTenantCode,
				adminOrgId,
			})
		} catch (error) {
			console.error('Controller error in clearCache:', error)
			return responses.failureResponse({
				statusCode: httpStatusCode.internal_server_error,
				message: 'CACHE_CLEAR_FAILED',
				responseCode: 'SERVER_ERROR',
			})
		}
	}

	/**
	 * Warm up cache for specific tenant/org
	 * @method
	 * @name warmUpCache
	 * @param {Object} req - request data
	 * @param {String} req.query.tenantCode - Tenant code to warm up (optional)
	 * @param {String} req.query.orgCode - Organization code to warm up (optional)
	 * @returns {JSON} - Cache warm up response
	 */
	async warmUpCache(req) {
		try {
			if (!req.decodedToken.roles.some((role) => role.title === common.ADMIN_ROLE)) {
				return responses.failureResponse({
					message: 'UNAUTHORIZED_REQUEST',
					statusCode: httpStatusCode.unauthorized,
					responseCode: 'UNAUTHORIZED',
				})
			}

			const { tenantCode, orgCode } = req.query
			const adminTenantCode = req.decodedToken.tenant_code
			const adminOrgCode = req.decodedToken.organization_code
			const adminOrgId = req.decodedToken.org

			return await adminService.warmUpCache({
				tenantCode: tenantCode || adminTenantCode,
				orgCode: orgCode || adminOrgCode,
				adminTenantCode,
				adminOrgCode,
			})
		} catch (error) {
			console.error('Controller error in warmUpCache:', error)
			return responses.failureResponse({
				statusCode: httpStatusCode.internal_server_error,
				message: 'CACHE_WARMUP_FAILED',
				responseCode: 'SERVER_ERROR',
			})
		}
	}

	/**
	 * Get cache configuration and health
	 * @method
	 * @name getCacheHealth
	 * @param {Object} req - request data
	 * @returns {JSON} - Cache health response
	 */
	async getCacheHealth(req) {
		try {
			if (!req.decodedToken.roles.some((role) => role.title === common.ADMIN_ROLE)) {
				return responses.failureResponse({
					message: 'UNAUTHORIZED_REQUEST',
					statusCode: httpStatusCode.unauthorized,
					responseCode: 'UNAUTHORIZED',
				})
			}

			return await adminService.getCacheHealth()
		} catch (error) {
			console.error('Controller error in getCacheHealth:', error)
			return responses.failureResponse({
				statusCode: httpStatusCode.internal_server_error,
				message: 'CACHE_HEALTH_CHECK_FAILED',
				responseCode: 'SERVER_ERROR',
			})
		}
	}
}
