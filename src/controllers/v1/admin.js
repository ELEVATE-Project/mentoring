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
			const userDelete = await adminService.userDelete(
				req.query.userId,
				req.decodedToken.id,
				req.decodedToken.organization_code,
				req.decodedToken.tenant_code,
				req.decodedToken.token
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
			if (!req.query.tenant_code) {
				const tenants = await userExtensionQueries.getDistinctTenantCodes()

				if (tenants.length > 0) {
					return await adminService.triggerPeriodicViewRefreshInternal(req.query.model_name, tenants[0].code)
				}

				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'NO_TENANTS_FOUND',
				})
			}

			// Specific tenantCode provided - refresh for that tenant only
			return await adminService.triggerPeriodicViewRefreshInternal(req.query.model_name, req.query.tenant_code)
		} catch (err) {
			console.log(err)
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
}
