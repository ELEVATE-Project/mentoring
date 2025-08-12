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
			if (!req.decodedToken.organizations[0].roles.some((role) => role.title === common.ADMIN_ROLE)) {
				return responses.failureResponse({
					message: 'UNAUTHORIZED_REQUEST',
					statusCode: httpStatusCode.unauthorized,
					responseCode: 'UNAUTHORIZED',
				})
			}
			const tenantCode = req.decodedToken.tenant_code
			const userDelete = await adminService.triggerViewRebuild(req.decodedToken, tenantCode)
			return userDelete
		} catch (error) {
			return error
		}
	}
	async triggerPeriodicViewRefresh(req) {
		try {
			if (!req.decodedToken.organizations[0].roles.some((role) => role.title === common.ADMIN_ROLE)) {
				return responses.failureResponse({
					message: 'UNAUTHORIZED_REQUEST',
					statusCode: httpStatusCode.unauthorized,
					responseCode: 'UNAUTHORIZED',
				})
			}
			const tenantCode = req.decodedToken.tenant_code
			return await adminService.triggerPeriodicViewRefresh(req.decodedToken, tenantCode)
		} catch (err) {
			console.log(err)
		}
	}
	async triggerViewRebuildInternal(req) {
		try {
			// Internal method - use default tenant or extract from query if needed
			const tenantCode = req.query.tenant_code || null
			return await adminService.triggerViewRebuild(null, tenantCode)
		} catch (error) {
			return error
		}
	}
	async triggerPeriodicViewRefreshInternal(req) {
		try {
			// Internal method - use default tenant or extract from query if needed
			const tenantCode = req.query.tenant_code || null
			return await adminService.triggerPeriodicViewRefreshInternal(req.query.model_name, tenantCode)
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
