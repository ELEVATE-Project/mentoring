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
				// Use direct cache key without tenant/org structure
				const cacheKey = `${common.CACHE_CONFIG.namespaces.permissions.name}:${cacheId}`

				// Try to get from cache first
				const cached = await cacheHelper.get(cacheKey)
				if (cached !== null && cached !== undefined) {
					permission = cached
				} else {
					// Fetch from database if not in cache
					permission = await permissionsQueries.findPermissionById(id)

					// Store in cache
					if (permission !== undefined) {
						const ttl = common.CACHE_CONFIG.namespaces.permissions.defaultTtl || 0
						await cacheHelper.set(cacheKey, permission, ttl || undefined)
					}
				}
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
			const cacheId = `all:${JSON.stringify({ filter, attributes, options })}`

			let permissions
			try {
				// Use direct cache key without tenant/org structure
				const cacheKey = `${common.CACHE_CONFIG.namespaces.permissions.name}:${cacheId}`

				// Try to get from cache first
				const cached = await cacheHelper.get(cacheKey)
				if (cached !== null && cached !== undefined) {
					permissions = cached
				} else {
					// Fetch from database if not in cache
					permissions = await permissionsQueries.findAllPermissions(filter, attributes, options)

					// Store in cache
					if (permissions !== undefined) {
						const ttl = common.CACHE_CONFIG.namespaces.permissions.defaultTtl || 0
						await cacheHelper.set(cacheKey, permissions, ttl || undefined)
					}
				}
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
			// Create cache ID based on filter and attributes (matching roles_permissions pattern)
			const cacheId = `find:${JSON.stringify({ filter, attributes })}`

			let permissions
			try {
				// Use direct Redis operations without tenant/org codes for permissions
				const cacheKey = `${common.CACHE_CONFIG.namespaces.permissions.name}:${cacheId}`

				// Try to get from cache first
				const cached = await cacheHelper.get(cacheKey)
				if (cached !== null && cached !== undefined) {
					permissions = cached
				} else {
					// Fetch from database if not in cache
					permissions = await permissionsQueries.find(filter, attributes)
					if (permissions !== undefined) {
						const ttl = common.CACHE_CONFIG.namespaces.permissions.defaultTtl || 0
						await cacheHelper.set(cacheKey, permissions, ttl || undefined)
					}
				}
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
			// Evict permission caches using direct pattern deletion (no tenant/org structure)
			await cacheHelper.scanAndDelete(`${common.CACHE_CONFIG.namespaces.permissions.name}:*`)

			// Also evict role_permissions namespace since they're related
			await cacheHelper.scanAndDelete(`${common.CACHE_CONFIG.namespaces.roles_permissions.name}:*`)
		} catch (err) {
			console.error('Permission cache invalidation failed', err)
			// Don't throw - cache failures should not block main operations
		}
	}
}
