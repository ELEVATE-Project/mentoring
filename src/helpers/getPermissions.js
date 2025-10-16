const rolePermissionMappingQueries = require('@database/queries/role-permission-mapping')
const common = require('@constants/common')
const responses = require('@helpers/responses')
const httpStatusCode = require('@generics/http-status')
const cacheHelper = require('@generics/cacheHelper')

module.exports = class UserHelper {
	// Your other methods here

	/**
	 * Get permissions by user roles.
	 * @method
	 * @name getPermissions
	 * @param {Array} userRoles - Array of user roles.
	 * @returns {Array} - Array of mentor permissions.
	 */
	static async getPermissions(userRoles) {
		try {
			const titles = userRoles.map((role) => role.title)
			const roleKey = titles.join(',')
			const cacheKey = `permissions:${roleKey}`

			try {
				return await cacheHelper.getOrSet({
					key: cacheKey,
					tenantCode: process.env.DEFAULT_TENANT_CODE, // Permissions are cross-tenant for now
					ns: 'permissions',
					ttl: 0, // No expiry as requested
					fetchFn: async () => {
						const filter = { role_title: titles }
						const attributes = ['module', 'request_type']
						const PermissionAndModules = await rolePermissionMappingQueries.findAll(filter, attributes)
						const PermissionByModules = PermissionAndModules.reduce(
							(PermissionByModules, { module, request_type }) => {
								if (PermissionByModules[module]) {
									PermissionByModules[module].request_type = [
										...new Set([...PermissionByModules[module].request_type, ...request_type]),
									]
								} else {
									PermissionByModules[module] = { module, request_type: [...request_type] }
								}
								return PermissionByModules
							},
							{}
						)

						const allPermissions = Object.values(PermissionByModules).map(({ module, request_type }) => ({
							module,
							request_type,
							service: common.MENTORING_SERVICE,
						}))

						return allPermissions
					},
				})
			} catch (cacheError) {
				console.error('Cache error in getPermissions, falling back to database:', cacheError)
				// Fallback to direct database query if cache fails
				const filter = { role_title: titles }
				const attributes = ['module', 'request_type']
				const PermissionAndModules = await rolePermissionMappingQueries.findAll(filter, attributes)
				const PermissionByModules = PermissionAndModules.reduce(
					(PermissionByModules, { module, request_type }) => {
						if (PermissionByModules[module]) {
							PermissionByModules[module].request_type = [
								...new Set([...PermissionByModules[module].request_type, ...request_type]),
							]
						} else {
							PermissionByModules[module] = { module, request_type: [...request_type] }
						}
						return PermissionByModules
					},
					{}
				)

				const allPermissions = Object.values(PermissionByModules).map(({ module, request_type }) => ({
					module,
					request_type,
					service: common.MENTORING_SERVICE,
				}))

				return allPermissions
			}
		} catch (error) {
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'PERMISSIONS_NOT_FOUND',
				result: { permissions: [] },
			})
		}
	}
}
