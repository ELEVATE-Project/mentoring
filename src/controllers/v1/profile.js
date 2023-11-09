const menteesHelper = require('@services/helper/mentees')
const mentorsHelper = require('@services/helper/mentors')
const { isAMentor } = require('@generics/utils')

module.exports = class Mentees {
	/**
	 * Create a new mentor or mentee extension.
	 * @method
	 * @name create
	 * @param {Object} req - Request data.
	 * @param {Object} req.body - Mentee extension data excluding user_id.
	 * @returns {Promise<Object>} - Created mentee extension details.
	 */
	async create(req) {
		try {
			if (isAMentor(req.decodedToken.roles)) {
				return await mentorsHelper.createMentorExtension(
					req.body,
					req.decodedToken.id,
					req.decodedToken.organization_id
				)
			}
			return await menteesHelper.createMenteeExtension(
				req.body,
				req.decodedToken.id,
				req.decodedToken.organization_id
			)
		} catch (error) {
			console.error(error)
			return error
		}
	}

	/**
	 * Update a mentor or mentee extension.
	 * @method
	 * @name update
	 * @param {Object} req - Request data.
	 * @param {String} req.decodedToken.id - User ID of the user.
	 * @param {Object} req.body - Updated user extension data excluding user_id.
	 * @returns {Promise<Object>} - Updated user extension details.
	 */
	async update(req) {
		try {
			if (isAMentor(req.decodedToken.roles)) {
				return await mentorsHelper.updateMentorExtension(
					req.body,
					req.decodedToken.id,
					req.decodedToken.organization_id
				)
			}
			return await menteesHelper.updateMenteeExtension(
				req.body,
				req.decodedToken.id,
				req.decodedToken.organization_id
			)
		} catch (error) {
			return error
		}
	}

	/**
	 * Get mentor or mentee extension by user ID.
	 * @method
	 * @name getExtension
	 * @param {Object} req - Request data.
	 * @param {String} req.params.id - User ID of the user.
	 * @returns {Promise<Object>} - user extension details.
	 */
	async getExtension(req) {
		try {
			if (isAMentor(req.decodedToken.roles)) {
				return await mentorsHelper.getMentorExtension(req.query.id || req.decodedToken.id)
			}
			return await menteesHelper.getMenteeExtension(req.decodedToken.id, req.decodedToken.organization_id) // params since read will be public for mentees
		} catch (error) {
			return error
		}
	}

	/**
	 * Get mentor or mentee extension by user ID.
	 * @method
	 * @name read
	 * @param {Object} req - Request data.
	 * @param {String} req.params.id - User ID of the user.
	 * @returns {Promise<Object>} - user extension details.
	 */
	async read(req) {
		try {
			if (isAMentor(req.decodedToken.roles)) {
				return await mentorsHelper.read(req.decodedToken.id, req.decodedToken.organization_id)
			}
			return await menteesHelper.read(req.decodedToken.id, req.decodedToken.organization_id)
		} catch (error) {
			return error
		}
	}

	async reActivate(req) {
		try {
			const userId = req.decodedToken.id
			const orgId = req.decodedToken.organization_id
			console.log(userId)
			console.log(orgId)

			if (!userId) {
				return common.failureResponse({
					statusCode: httpStatusCode.bad_request,
					message: 'MISSING_USER_ID',
				})
			}

			if (isAMentor(req.decodedToken.roles)) {
				return await mentorsHelper.activateMentorProfile(userId)
			} else {
				return await menteesHelper.activateMenteeProfile(userId)
			}
		} catch (error) {
			return error
		}
	}

	//To be enabled when delete flow is needed.
	// /**
	//  * Delete a mentee extension by user ID.
	//  * @method
	//  * @name deleteMenteeExtension
	//  * @param {Object} req - Request data.
	//  * @param {String} req.decodedToken.id - User ID of the mentee.
	//  * @returns {Promise<Boolean>} - True if deleted successfully, otherwise false.
	//  */
	// async delete(req) {
	// 	try {
	// 		if (isAMentor(req.decodedToken.roles)) {
	// 			return await mentorsHelper.deleteMentorExtension(req.body, req.decodedToken.id)
	// 		}
	// 		return await menteesHelper.deleteMenteeExtension(req.decodedToken.id)
	// 	} catch (error) {
	// 		return error
	// 	}
	// }
}
