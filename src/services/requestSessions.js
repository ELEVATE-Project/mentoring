const connectionQueries = require('@database/queries/connection')
const sessionRequestQueries = require('@database/queries/requestSessions')
module.exports = class requestSessionsHelper {
	/**
	 * Initiates a session request between two users.
	 * @param {Object} bodyData - The request body containing session related information.
	 * @param {string} bodyData.user_id - The ID of the target user.
	 * @param {string} userId - The ID of the user initiating the request.
	 * @returns {Promise<Object>} A success or failure response.
	 */
	static async create(bodyData, userId) {
		try {
			// Check if the target user exists
			const userExists = await userExtensionQueries.getMenteeExtension(bodyData.user_id)
			if (!userExists) {
				return responses.failureResponse({
					statusCode: httpStatusCode.not_found,
					message: 'USER_NOT_FOUND',
				})
			}

			// Check if a connection already exists between the users
			const connectionExists = await connectionQueries.getConnection(userId, bodyData.user_id)
			if (connectionExists?.status == common.CONNECTIONS_STATUS.BLOCKED) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'USER_NOT_FOUND',
				})
			}

			// if (connectionExists) {
			// 	return responses.successResponse({
			// 		statusCode: httpStatusCode.ok,
			// 		message: 'CONNECTION_EXITS',
			// 	})
			// }

			// Create a new connection request
			const SessionRequestResult = await sessionRequestQueries.addSessionRequest(
				userId,
				bodyData.user_id,
				bodyData.agenda,
				bodyData.start_date,
				bodyData.end_date
			)
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'SESSION_REQUEST_SEND_SUCCESSFULLY',
				result: SessionRequestResult,
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'SESSION_REQUEST_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			console.error(error)
			throw error
		}
	}

	static async create(bodyData, userId) {
		try {
			// Check if the target user (mentor) exists
			const userExists = await userExtensionQueries.getMenteeExtension(bodyData.user_id)
			if (!userExists) {
				return responses.failureResponse({
					statusCode: httpStatusCode.not_found,
					message: 'USER_NOT_FOUND',
				})
			}

			// Check if a connection already exists between the users
			const connectionExists = await connectionQueries.getConnection(userId, bodyData.user_id)

			if (connectionExists?.status === common.CONNECTIONS_STATUS.BLOCKED) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'USER_NOT_FOUND',
				})
			}

			// If not connected, restrict mentee to a single pending request
			if (!connectionExists) {
				const pendingRequest = await sessionRequestQueries.getPendingRequests(userId, bodyData.user_id)
				if (pendingRequest) {
					return responses.failureResponse({
						statusCode: httpStatusCode.bad_request,
						message: 'SESSION_REQUEST_PENDING',
					})
				}
			}

			// Validate mandatory fields based on entityTypes and entities
			// const orgConfig = await configQueries.getOrgConfig(userId);
			// if (!bodyData.start_date || !bodyData.end_date || !bodyData.agenda) {
			//     return responses.failureResponse({
			//         statusCode: httpStatusCode.bad_request,
			//         message: 'MANDATORY_FIELDS_MISSING',
			//     });
			// }

			// Check session timing constraints (within 3 months, minimum 30 minutes duration)
			const currentTime = new Date()
			const maxFutureDate = new Date()
			maxFutureDate.setMonth(maxFutureDate.getMonth() + 3)

			const startDate = new Date(bodyData.start_date)
			const endDate = new Date(bodyData.end_date)

			if (startDate < currentTime || endDate > maxFutureDate || endDate - startDate < 30 * 60 * 1000) {
				return responses.failureResponse({
					statusCode: httpStatusCode.bad_request,
					message: 'INVALID_SESSION_TIMING',
				})
			}

			// Create a new session request
			const SessionRequestResult = await sessionRequestQueries.addSessionRequest(
				userId,
				bodyData.user_id,
				bodyData.agenda,
				bodyData.start_date,
				bodyData.end_date
			)

			// Send email notification to mentor
			await notificationService.sendEmail({
				to: userExists.email,
				subject: 'New Session Request',
				body: `Dear ${userExists.name},\nYou have received a new session request from ${userId}. Please review and respond.`,
			})

			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'SESSION_REQUEST_SENT_SUCCESSFULLY',
				result: SessionRequestResult,
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'SESSION_REQUEST_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			console.error(error)
			throw error
		}
	}
}
