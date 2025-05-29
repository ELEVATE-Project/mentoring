const rolePermissionMappingQueries = require('@database/queries/role-permission-mapping')
const common = require('@constants/common')
const responses = require('@helpers/responses')
const httpStatusCode = require('@generics/http-status')
const utils = require('@generics/utils')

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
			userRoles = [{ title: 'mentee' }]
			const titles = userRoles.map((role) => role.title)
			const filter = { role_title: titles }
			const attributes = ['module', 'request_type']

			const cacheKey = userRoles
				.map((role) => role.title)
				.sort()
				.join(',')

			let rolePermission = await utils.internalGet(cacheKey)

			console.log(userRoles, '------', cacheKey, '========================', rolePermission)
			if (rolePermission) {
				return rolePermission
			} else {
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

				await utils.internalSet(cacheKey, allPermissions)

				return await utils.internalGet(cacheKey)
			}

			return allPermissions
		} catch (error) {
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'PERMISSIONS_NOT_FOUND',
				result: { permissions: [] },
			})
		}
	}
}
