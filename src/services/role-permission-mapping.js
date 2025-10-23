const httpStatusCode = require('@generics/http-status')
const rolePermissionMappingQueries = require('@database/queries/role-permission-mapping')
const permissionsQueries = require('@database/queries/permissions')
const permissionsService = require('@services/permissions')
const { UniqueConstraintError, ForeignKeyConstraintError } = require('sequelize')
const { Op } = require('sequelize')
const responses = require('@helpers/responses')
const cacheHelper = require('@generics/cacheHelper')
const common = require('@constants/common')

module.exports = class modulesHelper {
	/**
	 * Invalidate role-permission caches
	 * @method
	 * @name _invalidateRolePermissionCaches
	 * @param {string} roleTitle - Role title to invalidate cache for
	 */
	static async _invalidateRolePermissionCaches(roleTitle) {
		try {
			// Invalidate both cache namespaces used by role-permission system
			// Evict caches using direct pattern deletion (no tenant/org structure)
			await cacheHelper.scanAndDelete('roles_permissions:*')
			await cacheHelper.scanAndDelete('permissions:*')
		} catch (error) {
			console.error('Failed to invalidate role-permission caches:', error)
		}
	}

	/**
	 * Create rolePermission.
	 * @method
	 * @name create
	 * @param {Integer} roleId - user roleId
	 * @param {Integer} permissionId - role permissionId
	 * @param {Integer} id - user Id
	 * @returns {JSON} - RolePermission creation object.
	 */

	static async create(roleTitle, permissionId, id) {
		try {
			// Business Logic: Validate permission exists
			const permission = await permissionsService.findPermissionByIdCached(permissionId)
			if (!permission) {
				return responses.failureResponse({
					message: 'PERMISSION_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Business Logic: Prepare data for creation
			const data = {
				role_title: roleTitle,
				permission_id: permissionId,
				module: permission.module,
				request_type: permission.request_type,
				api_path: permission.api_path,
				created_by: id,
			}

			// Database Operation: Create role permission mapping
			const rolePermissionMapping = await rolePermissionMappingQueries.create(data)

			// Invalidate cache after successful creation
			await this._invalidateRolePermissionCaches(roleTitle)

			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'ROLE_PERMISSION_CREATED_SUCCESSFULLY',
				result: {
					role_Title: rolePermissionMapping.role_title,
					permission_Id: rolePermissionMapping.permission_id,
					module: rolePermissionMapping.module,
					request_type: rolePermissionMapping.request_type,
				},
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'ROLE_PERMISSION_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			throw error
		}
	}

	/**
	 * Delete rolePermission.
	 * @method
	 * @name delete
	 * @param {Integer} roleId - user roleId
	 * @param {Integer} permissionId - role permissionId
	 * @returns {JSON} - rolePermission deletion object.
	 */

	static async delete(roleTitle, permissionId) {
		try {
			const filter = { role_title: roleTitle, permission_id: permissionId }
			const rolePermissionMapping = await rolePermissionMappingQueries.delete(filter)
			if (rolePermissionMapping == 0) {
				return responses.failureResponse({
					message: 'ROLE_PERMISSION_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Invalidate cache after successful deletion
			await this._invalidateRolePermissionCaches(roleTitle)

			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'ROLE_PERMISSION_DELETED_SUCCESSFULLY',
				result: {},
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * list rolePermission.
	 * @method
	 * @name list
	 * @param {Integer} roleIds - role_id
	 * @returns {JSON} - RolePermission list object.
	 */

	static async list(roleTitle) {
		try {
			const filter = { role_title: roleTitle }
			const attributes = ['module', 'request_type']
			const permissionAndModules = await this.findAllCached(filter, attributes)
			const permissionsByModule = {}
			permissionAndModules.forEach(({ module, request_type }) => {
				if (permissionsByModule[module]) {
					permissionsByModule[module].request_type = [
						...new Set([...permissionsByModule[module].request_type, ...request_type]),
					]
				} else {
					permissionsByModule[module] = { module, request_type: [...request_type] }
				}
			})

			const permissions = Object.values(permissionsByModule).map(({ module, request_type }) => ({
				module,
				request_type,
			}))

			if (!permissions.length) {
				return responses.successResponse({
					statusCode: httpStatusCode.created,
					message: 'ROLE_PERMISSION_NOT_FOUND',
					result: { permissions: [] },
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'FETCHED_ROLE_PERMISSION_SUCCESSFULLY',
				result: { permissions },
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * List role permissions with caching (CACHED VERSION)
	 * Cache-first implementation with graceful fallback to database
	 * @method
	 * @name listCached
	 * @param {String} roleTitle - Role title
	 * @returns {Object} - Cached role permissions data
	 */
	static async listCached(roleTitle) {
		try {
			// Create cache ID based on role title
			const cacheId = `role_permissions:${roleTitle}`

			let permissionAndModules
			try {
				// Use direct cache key without tenant/org structure
				const cacheKey = `${common.CACHE_CONFIG.namespaces.roles_permissions.name}:${cacheId}`

				// Try to get from cache first
				const cached = await cacheHelper.get(cacheKey)
				if (cached !== null && cached !== undefined) {
					permissionAndModules = cached
				} else {
					// Fetch from database if not in cache
					const filter = { role_title: roleTitle }
					const attributes = ['module', 'request_type']
					permissionAndModules = await rolePermissionMappingQueries.findAll(filter, attributes)

					// Store in cache
					if (permissionAndModules !== undefined) {
						const ttl = common.CACHE_CONFIG.namespaces.roles_permissions.defaultTtl || 0
						await cacheHelper.set(cacheKey, permissionAndModules, ttl || undefined)
					}
				}
			} catch (cacheError) {
				console.warn('Cache system failed for role permissions, falling back to database:', cacheError.message)
				const filter = { role_title: roleTitle }
				const attributes = ['module', 'request_type']
				permissionAndModules = await rolePermissionMappingQueries.findAll(filter, attributes)
			}

			// Business logic: Process permissions by module
			const permissionsByModule = {}
			permissionAndModules.forEach(({ module, request_type }) => {
				if (permissionsByModule[module]) {
					permissionsByModule[module].request_type = [
						...new Set([...permissionsByModule[module].request_type, ...request_type]),
					]
				} else {
					permissionsByModule[module] = { module, request_type: [...request_type] }
				}
			})

			const permissions = Object.values(permissionsByModule).map(({ module, request_type }) => ({
				module,
				request_type,
			}))

			if (!permissions.length) {
				return responses.successResponse({
					statusCode: httpStatusCode.created,
					message: 'ROLE_PERMISSION_NOT_FOUND',
					result: { permissions: [] },
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'FETCHED_ROLE_PERMISSION_SUCCESSFULLY',
				result: { permissions },
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Find all role permissions with caching (CACHED VERSION)
	 * Cache-first implementation with graceful fallback to database
	 * @method
	 * @name findAllCached
	 * @param {Object} filter - Filter criteria
	 * @param {Array} attributes - Attributes to select
	 * @returns {Array} - Cached role permissions data
	 */
	static async findAllCached(filter, attributes) {
		try {
			// Create cache ID based on filter and attributes
			const cacheId = `role_perms_all:${JSON.stringify({ filter, attributes })}`

			let rolePermissions
			try {
				// Use direct cache key without tenant/org structure
				const cacheKey = `${common.CACHE_CONFIG.namespaces.roles_permissions.name}:${cacheId}`

				// Try to get from cache first
				const cached = await cacheHelper.get(cacheKey)
				if (cached !== null && cached !== undefined) {
					rolePermissions = cached
				} else {
					// Fetch from database if not in cache
					rolePermissions = await rolePermissionMappingQueries.findAll(filter, attributes)

					// Store in cache
					if (rolePermissions !== undefined) {
						const ttl = common.CACHE_CONFIG.namespaces.roles_permissions.defaultTtl || 0
						await cacheHelper.set(cacheKey, rolePermissions, ttl || undefined)
					}
				}
			} catch (cacheError) {
				console.warn(
					'Cache system failed for role permissions findAll, falling back to database:',
					cacheError.message
				)
				rolePermissions = await rolePermissionMappingQueries.findAll(filter, attributes)
			}

			return rolePermissions
		} catch (error) {
			throw error
		}
	}
}
