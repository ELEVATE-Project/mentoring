/**
 * name : controllers/v1/cache-admin.js
 * author : Claude Code Assistant
 * created-date : 15-Oct-2025
 * Description : Cache administration endpoints for Redis cache management
 * Access: Admin roles only (admin, org_admin)
 */

const cacheHelper = require('@generics/cacheHelper')
const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')
const common = require('@constants/common')

module.exports = class CacheAdminController {
	/**
	 * Clear all cached data
	 * @method
	 * @name clearAll
	 * @param {Object} req - Request object
	 * @param {Object} res - Response object
	 * @returns {JSON} - Cache clear response
	 */
	static async clearAll(req, res) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationId = req.decodedToken.organization_id

			// Clear all cache namespaces for the tenant
			const namespaces = Object.keys(common.CACHE_CONFIG.namespaces)
			const clearPromises = namespaces.map(async (namespace) => {
				try {
					await cacheHelper.evictNamespace({
						tenantCode,
						orgCode: organizationId,
						ns: namespace,
					})
					return { namespace, status: 'cleared' }
				} catch (error) {
					console.error(`Failed to clear namespace ${namespace}:`, error)
					return { namespace, status: 'failed', error: error.message }
				}
			})

			const results = await Promise.allSettled(clearPromises)
			const cleared = results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
			const failed = results.filter((r) => r.status === 'rejected').map((r) => r.reason)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'CACHE_CLEAR_ALL_COMPLETED',
				result: {
					tenant_code: tenantCode,
					organization_id: organizationId,
					cleared_namespaces: cleared,
					failed_operations: failed,
					total_namespaces: namespaces.length,
				},
			})
		} catch (error) {
			console.error('Cache clear all failed:', error)
			return responses.failureResponse({
				message: 'CACHE_CLEAR_ALL_FAILED',
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'SERVER_ERROR',
			})
		}
	}

	/**
	 * Clear specific cache key
	 * @method
	 * @name clearKey
	 * @param {Object} req - Request object
	 * @param {Object} res - Response object
	 * @returns {JSON} - Cache clear response
	 */
	static async clearKey(req, res) {
		try {
			const { key } = req.params
			const tenantCode = req.decodedToken.tenant_code
			const organizationId = req.decodedToken.organization_id

			if (!key) {
				return responses.failureResponse({
					message: 'CACHE_KEY_REQUIRED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Clear specific cache key with tenant context
			await cacheHelper.evictKey({
				tenantCode,
				orgCode: organizationId,
				key: key,
			})

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'CACHE_KEY_CLEARED_SUCCESSFULLY',
				result: {
					tenant_code: tenantCode,
					organization_id: organizationId,
					cleared_key: key,
				},
			})
		} catch (error) {
			console.error('Cache clear key failed:', error)
			return responses.failureResponse({
				message: 'CACHE_CLEAR_KEY_FAILED',
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'SERVER_ERROR',
			})
		}
	}

	/**
	 * Clear forms cache specifically
	 * @method
	 * @name clearForms
	 * @param {Object} req - Request object
	 * @param {Object} res - Response object
	 * @returns {JSON} - Cache clear response
	 */
	static async clearForms(req, res) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationId = req.decodedToken.organization_id

			// Clear forms namespace
			await cacheHelper.evictNamespace({
				tenantCode,
				orgCode: organizationId,
				ns: common.CACHE_CONFIG.namespaces.forms.name,
			})

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'FORMS_CACHE_CLEARED_SUCCESSFULLY',
				result: {
					tenant_code: tenantCode,
					organization_id: organizationId,
					cleared_namespace: 'forms',
				},
			})
		} catch (error) {
			console.error('Forms cache clear failed:', error)
			return responses.failureResponse({
				message: 'FORMS_CACHE_CLEAR_FAILED',
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'SERVER_ERROR',
			})
		}
	}

	/**
	 * Clear entities cache specifically
	 * @method
	 * @name clearEntities
	 * @param {Object} req - Request object
	 * @param {Object} res - Response object
	 * @returns {JSON} - Cache clear response
	 */
	static async clearEntities(req, res) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationId = req.decodedToken.organization_id

			// Clear both entities and entity_types namespaces as they're related
			const clearPromises = [
				cacheHelper.evictNamespace({
					tenantCode,
					orgCode: organizationId,
					ns: common.CACHE_CONFIG.namespaces.entities.name,
				}),
				cacheHelper.evictNamespace({
					tenantCode,
					orgCode: organizationId,
					ns: common.CACHE_CONFIG.namespaces.entity_types.name,
				}),
			]

			await Promise.all(clearPromises)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ENTITIES_CACHE_CLEARED_SUCCESSFULLY',
				result: {
					tenant_code: tenantCode,
					organization_id: organizationId,
					cleared_namespaces: ['entities', 'entity_types'],
				},
			})
		} catch (error) {
			console.error('Entities cache clear failed:', error)
			return responses.failureResponse({
				message: 'ENTITIES_CACHE_CLEAR_FAILED',
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'SERVER_ERROR',
			})
		}
	}

	/**
	 * Clear sessions cache specifically
	 * @method
	 * @name clearSessions
	 * @param {Object} req - Request object
	 * @param {Object} res - Response object
	 * @returns {JSON} - Cache clear response
	 */
	static async clearSessions(req, res) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationId = req.decodedToken.organization_id

			// Clear sessions namespace
			await cacheHelper.evictNamespace({
				tenantCode,
				orgCode: organizationId,
				ns: common.CACHE_CONFIG.namespaces.sessions.name,
			})

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'SESSIONS_CACHE_CLEARED_SUCCESSFULLY',
				result: {
					tenant_code: tenantCode,
					organization_id: organizationId,
					cleared_namespace: 'sessions',
				},
			})
		} catch (error) {
			console.error('Sessions cache clear failed:', error)
			return responses.failureResponse({
				message: 'SESSIONS_CACHE_CLEAR_FAILED',
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'SERVER_ERROR',
			})
		}
	}

	/**
	 * Clear notification templates cache specifically
	 * @method
	 * @name clearNotificationTemplates
	 * @param {Object} req - Request object
	 * @param {Object} res - Response object
	 * @returns {JSON} - Cache clear response
	 */
	static async clearNotificationTemplates(req, res) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationId = req.decodedToken.organization_id

			// Clear notification templates namespace
			await cacheHelper.evictNamespace({
				tenantCode,
				orgCode: organizationId,
				ns: common.CACHE_CONFIG.namespaces.notification_templates.name,
			})

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'NOTIFICATION_TEMPLATES_CACHE_CLEARED_SUCCESSFULLY',
				result: {
					tenant_code: tenantCode,
					organization_id: organizationId,
					cleared_namespace: 'notification_templates',
				},
			})
		} catch (error) {
			console.error('Notification templates cache clear failed:', error)
			return responses.failureResponse({
				message: 'NOTIFICATION_TEMPLATES_CACHE_CLEAR_FAILED',
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'SERVER_ERROR',
			})
		}
	}

	/**
	 * Get cache health status and statistics
	 * @method
	 * @name healthCheck
	 * @param {Object} req - Request object
	 * @param {Object} res - Response object
	 * @returns {JSON} - Cache health response
	 */
	static async healthCheck(req, res) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationId = req.decodedToken.organization_id

			// Check Redis connection health
			const healthStatus = await cacheHelper.healthCheck()

			// Get basic cache info
			const cacheInfo = {
				redis_connected: healthStatus.connected || false,
				cache_enabled: common.CACHE_CONFIG.enableCache,
				available_namespaces: Object.keys(common.CACHE_CONFIG.namespaces),
				namespace_configs: common.CACHE_CONFIG.namespaces,
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'CACHE_HEALTH_CHECK_COMPLETED',
				result: {
					tenant_code: tenantCode,
					organization_id: organizationId,
					cache_info: cacheInfo,
					timestamp: new Date().toISOString(),
				},
			})
		} catch (error) {
			console.error('Cache health check failed:', error)
			return responses.failureResponse({
				message: 'CACHE_HEALTH_CHECK_FAILED',
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'SERVER_ERROR',
			})
		}
	}
}
