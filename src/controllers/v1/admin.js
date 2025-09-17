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
			const tenantCode = req.decodedToken.tenant_code
			const userDelete = await adminService.userDelete(req.query.userId, tenantCode)
			return userDelete
		} catch (error) {
			return error
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
			// Use tenant_code from query param if provided, otherwise use token tenant_code, otherwise null (all tenants)
			const tenantCode = req.query.tenant_code || req.decodedToken.tenant_code || null
			const result = await adminService.triggerViewRebuild(req.decodedToken, tenantCode)
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
			// Use tenant_code from query param if provided, otherwise use token tenant_code, otherwise null (all tenants)
			const tenantCode = req.query.tenant_code || req.decodedToken.tenant_code || null
			return await adminService.triggerPeriodicViewRefresh(req.decodedToken, tenantCode)
		} catch (err) {
			console.log(err)
		}
	}
	async triggerViewRebuildInternal(req) {
		try {
			// Internal method - tenant_code is now required for tenant-specific views
			const tenantCode = req.query.tenant_code
			if (!tenantCode) {
				return responses.failureResponse({
					message: 'TENANT_CODE_REQUIRED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return await adminService.triggerViewRebuild(null, tenantCode)
		} catch (error) {
			return error
		}
	}
	async triggerPeriodicViewRefreshInternal(req) {
		try {
			// Internal method - tenant_code is now required for tenant-specific views
			const tenantCode = req.query.tenant_code
			const modelName = req.query.model_name

			if (!tenantCode) {
				return responses.failureResponse({
					message: 'TENANT_CODE_REQUIRED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return await adminService.triggerPeriodicViewRefreshInternal(modelName, tenantCode)
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
