// Dependencies
const httpStatusCode = require('@generics/http-status')
const common = require('@constants/common')
const userRequests = require('@requests/user')
const menteeQueries = require('@database/queries/userExtension')
const mentorQueries = require('@database/queries/mentorExtension')
const userExtension = require('@database/models/userExtension')
module.exports = class UserHelper {
	/**
	 * Get user list.
	 * @method
	 * @name create
	 * @param {String} userType - mentee/mentor.
	 * @param {Number} pageSize -  Page size.
	 * @param {Number} pageNo -  Page number.
	 * @param {String} searchText -  Search text.
	 * @returns {JSON} - User list.
	 */

	static async list(userType, pageNo, pageSize, searchText) {
		try {
			const userDetails = await userRequests.list(userType, pageNo, pageSize, searchText)

			const ids = userDetails.data.result.data.map((item) => item.values[0].id)
			let extensionDetails
			if (userType == common.MENTEE_ROLE) {
				extensionDetails = await menteeQueries.getUsersByUserIds(ids, {
					attributes: ['user_id', 'rating'],
				})
			} else if (userType == common.MENTOR_ROLE) {
				extensionDetails = await mentorQueries.getMentorsByUserIds(ids, {
					attributes: ['user_id', 'rating'],
				})
			}

			const extensionDataMap = new Map(extensionDetails.map((newItem) => [newItem.user_id, newItem]))

			userDetails.data.result.data.forEach((existingItem) => {
				const user_id = existingItem.values[0].id
				if (extensionDataMap.has(user_id)) {
					const newItem = extensionDataMap.get(user_id)
					existingItem.values[0] = { ...existingItem.values[0], ...newItem }
				}
				delete existingItem.values[0].user_id
			})

			return common.successResponse({
				statusCode: httpStatusCode.ok,
				message: userDetails.data.message,
				result: userDetails.data.result,
			})
		} catch (error) {
			throw error
		}
	}
	/**
	 * Delete a user.
	 * @method
	 * @name delete
	 * @param {String} userType - mentee/mentor.
	 * @param {Integer} userId - User ID to delete.
	 * @returns {JSON} - user delete
	 */
	static async deleteUser(id) {
		try {
			// Assuming you have a database model and a method to update the user's status
			const user = await userExtension.getUsersByUserIds(id)

			if (!user) {
				return common.failureResponse({
					message: 'USER_DOES_NOT_EXIST',
					statusCode: httpStatusCode.internal_server_error,
					responseCode: 'SERVER_ERROR',
				})
			}

			// Update the user's status to "deleted"
			const deletedrows = await userExtension.updatMenteeExtension(id, {
				status: 'DELETED',
				name: 'Deleted User',
			})
			if (deletedrows === 0) {
				return common.failureResponse({
					message: 'User_DELETION_FAILED',
					statusCode: httpStatusCode.internal_server_error,
					responseCode: 'SERVER_ERROR',
				})
			}

			return common.successResponse({
				message: 'USER_DELETED',
				statusCode: httpStatusCode.ok,
				responseCode: 'USEREXTENSION_DELETED_SUCESSFULLY',
			})
		} catch (error) {
			throw error
		}
	}
}
