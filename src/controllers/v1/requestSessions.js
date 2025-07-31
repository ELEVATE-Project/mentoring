const requestSessionsService = require('@services/requestSessions')
const { isAMentor } = require('@generics/utils')
const common = require('@constants/common')

module.exports = class requestsSessions {
	/**
	 * Initiates a session request between two users.
	 * @param {Object} bodyData - The request body requesting session related information.
	 * @param {string} bodyData.friend_id - The ID of the target user.
	 * @param {string} userId - The ID of the user initiating the request.
	 * @returns {Promise<Object>} A success or failure response.
	 */
	async create(req) {
		try {
			const SkipValidation = req.query.SkipValidation ? req.query.SkipValidation : false
			return await requestSessionsService.create(
				req.body,
				req.decodedToken.id,
				req.decodedToken.organization_id,
				SkipValidation
			)
		} catch (error) {
			return error
		}
	}

	/**
	 * Get a list of pending session requests for a user.
	 * @param {string} userId - The ID of the user.
	 * @param {number} pageNo - The page number for pagination.
	 * @param {number} pageSize - The number of records per page.
	 * @returns {Promise<Object>} The list of pending session requests.
	 */
	async list(req) {
		try {
			const requestSessionDetails = await requestSessionsService.list(
				req.decodedToken.id,
				req.query.pageNo,
				req.query.pageSize,
				req.query.status ? req.query.status.split(',').map((s) => s.trim()) : []
			)
			return requestSessionDetails
		} catch (error) {
			return error
		}
	}

	/**
	 * Accept a pending session request.
	 * @param {Object} bodyData - The body data containing the target user ID.
	 * @param {string} bodyData.user_id - The ID of the target user.
	 * @param {string} mentorUserId - The ID of the authenticated user.
	 * @param {string} organization_id - the ID of the user organization.
	 * @returns {Promise<Object>} A success response indicating the request was accepted.
	 */
	async accept(req) {
		try {
			if (req.headers.timezone) {
				req.body['time_zone'] = req.headers.timezone
			}
			const acceptRequestSession = await requestSessionsService.accept(
				req.body,
				req.decodedToken.id,
				req.decodedToken.organization_id,
				isAMentor(req.decodedToken.roles)
			)
			return acceptRequestSession
		} catch (error) {
			throw error
		}
	}

	/**
	 * Reject a pending session request.
	 * @param {Object} bodyData - The body data containing the target user ID.
	 * @param {string} bodyData.user_id - The ID of the target user.
	 * @param {string} mentorUserId - The ID of the authenticated user.
	 * @param {string} organization_id - the ID of the user organization.
	 * @returns {Promise<Object>} A success response indicating the request was rejected.
	 */
	async reject(req) {
		try {
			return await requestSessionsService.reject(req.body, req.decodedToken.id, req.decodedToken.organization_id)
		} catch (error) {
			throw error
		}
	}

	/**
	 * get details of session request.
	 * @param {Object} bodyData - The body data containing the target user ID.
	 * @param {string} bodyData.request_session_id - The ID of the target user.
	 * @param {string} userId - The ID of the user initiating the request.
	 * @returns {Promise<Object>} A success or failure response.
	 */
	async getDetails(req) {
		try {
			return await requestSessionsService.getInfo(req.query.request_session_id, req.decodedToken.id)
		} catch (error) {
			throw error
		}
	}

	/**
	 * get user availability for a session.
	 * @param {Object} bodyData - The body data containing the target user ID.
	 * @param {string} bodyData.request_session_id - The ID of the target user.
	 * @param {string} userId - The ID of the user initiating the request.
	 * @param {integer} pageNo - Page no for the data
	 * @param {integer} pageSize - Limit of the data to be shown
	 * @param {string} status - Status of the request
	 * @param {string} roles - Role of the user
	 * @returns {Promise<Object>} A success or failure response.
	 */
	async userAvailability(req) {
		try {
			return await requestSessionsService.userAvailability(
				req.decodedToken.id,
				req.query.pageNo,
				req.query.pageSize,
				req.query.searchText,
				req.query.status,
				req.decodedToken.roles,
				req.query.start_date,
				req.query.end_date
			)
		} catch (error) {
			throw error
		}
	}

	/**
	 * Expire Request Session.
	 * @name expire
	 * @param {Object} req -request data.
	 * @param {String} req.params.id - Session Id.
	 * @returns {JSON} - Expire session callback url.
	 */

	async expire(req) {
		try {
			const sessionsExpire = await requestSessionsService.expire(req.params.id)
			return sessionsExpire
		} catch (error) {
			return error
		}
	}
}
