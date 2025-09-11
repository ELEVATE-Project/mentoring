/**
 * name : feedback.js
 * author : Rakesh Kumar
 * created-date : 02-Dec-2021
 * Description : Users Controller.
 */

// Dependencies
const { isAMentor } = require('@generics/utils')
const feedbackService = require('@services/feedback')
const userService = require('@services/users')
const adminService = require('@services/admin')

module.exports = class Users {
	/**
	 * Pending feedback.
	 * @method
	 * @name pendingFeedbacks
	 * @param {Object} req -request data.
	 * @param {String} req.decodedToken.id - User Id.
	 * @param {String} req.decodedToken.isAMentor - User Mentor key true/false.
	 * @returns {JSON} - Pending feedback information.
	 */

	async pendingFeedbacks(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const pendingFeedBacks = await feedbackService.pending(
				userId,
				isAMentor(req.decodedToken.roles),
				organizationCode,
				tenantCode
			)
			return pendingFeedBacks
		} catch (error) {
			return error
		}
	}

	/**
	 * list user based on type
	 * @method
	 * @name list
	 * @param {Object} req 						- request data.
	 * @param {Boolean} req.query.type 			- User Type mentor/mentee
	 * @param {Number} req.pageNo 				- page no.
	 * @param {Number} req.pageSize 			- page size limit.
	 * @param {String} req.searchText 			- search text.
	 * @returns {JSON} 							- List of user.
	 */

	async list(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			const listUser = await userService.list(
				req.query.type,
				req.pageNo,
				req.pageSize,
				req.searchText,
				userId,
				organizationCode,
				tenantCode
			)
			return listUser
		} catch (error) {
			return error
		}
	}

	/**
	 * Creates a new user record if one doesn't already exist.
	 * Intended to be used after user login to register them in the system.
	 * @method
	 * @name create
	 * @param {Object} req - Request object.
	 * @param {Object} req.decodedToken - Decoded token object from authenticated user.
	 * @returns {JSON} - Success or failure message.
	 */
	async create(req) {
		try {
			const tenantCode = req.decodedToken.tenant_code
			const organizationCode = req.decodedToken.organization_code
			const userId = req.decodedToken.id

			return await userService.create(req.decodedToken, userId, organizationCode, tenantCode)
		} catch (error) {
			return error
		}
	}

	/**
	 * Adds a new user to the system.
	 * Used by an admin or internal service to register users with full input.
	 * @method
	 * @name add
	 * @param {Object} req - Request object.
	 * @param {Object} req.body - User details (name, email, type, etc.)
	 * @returns {JSON} - Success or failure response.
	 */
	async add(req) {
		try {
			const tenantCode = req.body.tenant_code
			const organizationCode = req.body.organization_code
			const userId = req.body.id

			return await userService.add(req.body, userId, organizationCode, tenantCode)
		} catch (error) {
			return error
		}
	}

	/**
	 * Updates user details like name, role, or profile data.
	 * @method
	 * @name update
	 * @param {Object} req - Request object.
	 * @param {Object} req.body - Updated user details.
	 * @returns {JSON} - Update status and response data.
	 */
	async update(req) {
		try {
			const tenantCode = req.body.tenant_code
			const organizationCode = req.body.organization_code
			const userId = req.body.id

			return await userService.update(req.body, req.decodedToken, userId, organizationCode, tenantCode)
		} catch (error) {
			return error
		}
	}

	/**
	 * Deletes a user by internal user ID.
	 * Only accessible to admin users.
	 * @method
	 * @name delete
	 * @param {Object} req - Request object.
	 * @param {String} req.body.id - Internal user ID to delete.
	 * @returns {JSON} - Deletion status and response.
	 */
	async delete(req) {
		try {
			const tenantCode = req.body.tenant_code
			return await adminService.userDelete(req.body.id.toString(), tenantCode)
		} catch (error) {
			return error
		}
	}

	/**
	 * Get user's connection and session request counts
	 * @method
	 * @name requestCount
	 * @param {Object} req - Request object.
	 * @returns {JSON} - Request counts with success/failure response.
	 */
	async requestCount(req) {
		try {
			const tenantCode = req.body.tenant_code
			return await userService.requestCount(req.decodedToken.id, tenantCode)
		} catch (error) {
			return error
		}
	}
}
