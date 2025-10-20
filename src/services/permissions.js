// Dependencies
const httpStatusCode = require('@generics/http-status')
const common = require('@constants/common')
const permissionsQueries = require('@database/queries/permissions')
const { UniqueConstraintError, ForeignKeyConstraintError } = require('sequelize')
const { Op } = require('sequelize')
const responses = require('@helpers/responses')
const cacheHelper = require('@generics/cacheHelper')

module.exports = class PermissionsHelper {
	/**
	 * Create permissions.
	 * @method
	 * @name create
	 * @param {Object} bodyData - permissions body data.
	 * @param {String} id -  id.
	 * @returns {JSON} - Permissions created response.
	 */

	static async create(bodyData) {
		try {
			const permissions = await permissionsQueries.createPermission(bodyData)

			// Invalidate permission caches after successful creation
			await this._invalidatePermissionCaches()

			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'PERMISSION_CREATED_SUCCESSFULLY',
				result: {
					Id: permissions.id,
					status: permissions.status,
					module: permissions.module,
					request_type: permissions.request_type,
				},
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				const uniqueConstraintErrors = error.errors
				const uniqueFields = uniqueConstraintErrors.map((constraintError) => {
					return constraintError.path
				})
				const isCodeUnique = uniqueFields.includes('code')
				let errorMessage = ''
				if (!isCodeUnique) {
					errorMessage += 'code '
				}
				return responses.failureResponse({
					message: `${errorMessage.trim()} should be unique.`,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			throw error
		}
	}

	/**
	 * Update permissions.
	 * @method
	 * @name update
	 * @param {Object} bodyData - permissions body data.
	 * @param {String} _id - permissions id.
	 * @param {String} loggedInUserId - logged in user id.
	 * @returns {JSON} - permissions updated response.
	 */

	static async update(id, bodyData) {
		try {
			const filter = { id }
			const permissions = await this.findPermissionByIdCached(id)
			if (!permissions) {
				throw new Error('PERMISSION_NOT_FOUND')
			}
			const updatedPermission = await permissionsQueries.updatePermissions(filter, bodyData)

			// Invalidate permission caches after successful update
			if (updatedPermission) {
				await this._invalidatePermissionCaches()
			}

			if (!updatedPermission) {
				return responses.failureResponse({
					message: 'PERMISSION_NOT_UPDATED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			} else {
				return responses.successResponse({
					statusCode: httpStatusCode.created,
					message: 'PERMISSION_UPDATED_SUCCESSFULLY',
					result: {
						Id: updatedPermission.id,
						status: updatedPermission.status,
						module: updatedPermission.module,
						request_type: permissions.request_type,
					},
				})
			}
		} catch (error) {
			throw error
		}
	}

	/**
	 * Delete permissions.
	 * @method
	 * @name delete
	 * @param {String} _id - Delete permissions.
	 * @returns {JSON} - permissions deleted response.
	 */

	static async delete(id) {
		try {
			const permissions = await this.findPermissionByIdCached(id)

			if (!permissions) {
				throw new Error('PERMISSION_NOT_FOUND')
			}
			const deletePermission = await permissionsQueries.deletePermissionById(id)

			// Invalidate permission caches after successful deletion
			if (deletePermission) {
				await this._invalidatePermissionCaches()
			}

			if (!deletePermission) {
				return responses.failureResponse({
					message: 'PERMISSION_NOT_DELETED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'PERMISSION_DELETED_SUCCESSFULLY',
				result: {},
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * list permissions.
	 * @method
	 * @name list
	 * @param {String} id -  id.
	 * @returns {JSON} - Permissions list response.
	 */

	static async list(page, limit, search) {
		try {
			const offset = common.getPaginationOffset(page, limit)

			const filter = {
				code: { [Op.iLike]: `%${search}%` },
			}
			const options = {
				offset,
				limit,
			}
			const attributes = ['id', 'code', 'module', 'request_type', 'api_path', 'status']
			const permissions = await this.findAllPermissionsCached(filter, attributes, options)

			if (permissions.rows == 0 || permissions.count == 0) {
				return responses.failureResponse({
					message: 'PERMISSION_HAS_EMPTY_LIST',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			} else {
				const results = {
					data: permissions.rows,
					count: permissions.count,
				}

				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'PERMISSION_FETCHED_SUCCESSFULLY',
					result: { results },
				})
			}
		} catch (error) {
			throw error
		}
	}

	/**
	 * Find permission by ID with caching (CACHED VERSION)
	 * Cache-first implementation with graceful fallback to database
	 * @method
	 * @name findPermissionByIdCached
	 * @param {String} id - Permission ID
	 * @returns {Object} - Cached permission data
	 */
	static async findPermissionByIdCached(id) {
		try {
			// Create cache ID based on permission ID
			const cacheId = `permission:${id}`

			let permission
			try {
				permission = await cacheHelper.getOrSet({
					tenantCode: process.env.DEFAULT_TENANT_CODE || 'default',
					orgCode: 'default',
					ns: common.CACHE_CONFIG.namespaces.permissions.name,
					id: cacheId,
					fetchFn: async () => {
						return await permissionsQueries.findPermissionById(id)
					},
				})
			} catch (cacheError) {
				console.warn('Cache system failed for permission by ID, falling back to database:', cacheError.message)
				permission = await permissionsQueries.findPermissionById(id)
			}

			return permission
		} catch (error) {
			throw error
		}
	}

	/**
	 * Find all permissions with caching (CACHED VERSION)
	 * Cache-first implementation with graceful fallback to database
	 * @method
	 * @name findAllPermissionsCached
	 * @param {Object} filter - Filter criteria
	 * @param {Array} attributes - Attributes to select
	 * @param {Object} options - Query options
	 * @returns {Object} - Cached permissions data
	 */
	static async findAllPermissionsCached(filter, attributes, options = {}) {
		try {
			// Create cache ID based on all parameters
			const cacheId = `permissions_all:${JSON.stringify({ filter, attributes, options })}`

			let permissions
			try {
				permissions = await cacheHelper.getOrSet({
					tenantCode: process.env.DEFAULT_TENANT_CODE || 'default',
					orgCode: 'default',
					ns: common.CACHE_CONFIG.namespaces.permissions.name,
					id: cacheId,
					fetchFn: async () => {
						return await permissionsQueries.findAllPermissions(filter, attributes, options)
					},
				})
			} catch (cacheError) {
				console.warn(
					'Cache system failed for permissions findAll, falling back to database:',
					cacheError.message
				)
				permissions = await permissionsQueries.findAllPermissions(filter, attributes, options)
			}

			return permissions
		} catch (error) {
			throw error
		}
	}

	/**
	 * Find permission by filter with caching (CACHED VERSION)
	 * Cache-first implementation with graceful fallback to database
	 * @method
	 * @name findCached
	 * @param {Object} filter - Filter criteria
	 * @param {Array} attributes - Attributes to select
	 * @returns {Object} - Cached permissions data
	 */
	static async findCached(filter, attributes) {
		try {
			// Create cache ID based on filter and attributes
			const cacheId = `permissions_find:${JSON.stringify({ filter, attributes })}`

			let permissions
			try {
				permissions = await cacheHelper.getOrSet({
					tenantCode: process.env.DEFAULT_TENANT_CODE || 'default',
					orgCode: 'default',
					ns: common.CACHE_CONFIG.namespaces.permissions.name,
					id: cacheId,
					fetchFn: async () => {
						return await permissionsQueries.find(filter, attributes)
					},
				})
			} catch (cacheError) {
				console.warn('Cache system failed for permissions find, falling back to database:', cacheError.message)
				permissions = await permissionsQueries.find(filter, attributes)
			}

			return permissions
		} catch (error) {
			throw error
		}
	}

	/**
	 * Invalidate permission related caches after CUD operations
	 * Following the established pattern for permission cache invalidation
	 */
	static async _invalidatePermissionCaches() {
		try {
			// Evict permissions namespace
			await cacheHelper.evictNamespace({
				tenantCode: process.env.DEFAULT_TENANT_CODE || 'default',
				orgCode: 'default',
				ns: common.CACHE_CONFIG.namespaces.permissions.name,
			})

			// Also evict role_permissions namespace since they're related
			await cacheHelper.evictNamespace({
				tenantCode: process.env.DEFAULT_TENANT_CODE || 'default',
				orgCode: 'default',
				ns: common.CACHE_CONFIG.namespaces.roles_permissions.name,
			})
		} catch (err) {
			console.error('Permission cache invalidation failed', err)
			// Don't throw - cache failures should not block main operations
		}
	}
}
