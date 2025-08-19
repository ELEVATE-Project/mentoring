const httpStatusCode = require('@generics/http-status')
const connectionQueries = require('@database/queries/connection')
const responses = require('@helpers/responses')
const userExtensionQueries = require('@database/queries/userExtension')
const { UniqueConstraintError } = require('sequelize')
const common = require('@constants/common')
const entityTypeService = require('@services/entity-type')
const entityTypeQueries = require('@database/queries/entityType')
const { Op } = require('sequelize')
const { getDefaults } = require('@helpers/getDefaultOrgId')
const { removeDefaultOrgEntityTypes } = require('@generics/utils')
const utils = require('@generics/utils')
const communicationHelper = require('@helpers/communications')
const userRequests = require('@requests/user')
const notificationQueries = require('@database/queries/notificationTemplate')
const kafkaCommunication = require('@generics/kafka-communication')
const mentorExtensionQueries = require('@database/queries/mentorExtension')

module.exports = class ConnectionHelper {
	/**
	 * Check if a connection request already exists between two users.
	 * @param {string} userId - The ID of the user making the request.
	 * @param {string} targetUserId - The ID of the target user.
	 * @returns {Promise<Object|undefined>} The connection request if it exists, otherwise a failure response.
	 */
	static async checkConnectionRequestExists(userId, targetUserId, tenantCode) {
		const connectionRequest = await connectionQueries.findOneRequest(userId, targetUserId, tenantCode)
		if (!connectionRequest) {
			return false
		}
		return connectionRequest
	}

	/**
	 * Initiates a connection request between two users.
	 * @param {Object} bodyData - The request body containing user information.
	 * @param {string} bodyData.user_id - The ID of the target user.
	 * @param {string} userId - The ID of the user initiating the request.
	 * @returns {Promise<Object>} A success or failure response.
	 */
	static async initiate(bodyData, userId, tenantCode) {
		try {
			// Check if the target user exists
			const userExists = await userExtensionQueries.getMenteeExtension(bodyData.user_id, [], false, tenantCode)
			if (!userExists) {
				return responses.failureResponse({
					statusCode: httpStatusCode.not_found,
					message: 'USER_NOT_FOUND',
				})
			}

			// Check if a connection already exists between the users
			const connectionExists = await connectionQueries.getConnection(userId, bodyData.user_id, tenantCode)
			if (connectionExists?.status == common.CONNECTIONS_STATUS.BLOCKED) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'USER_NOT_FOUND',
				})
			}

			if (connectionExists) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'CONNECTION_EXITS',
				})
			}

			// Create a new connection request
			const friendRequestResult = await connectionQueries.addFriendRequest(
				userId,
				bodyData.user_id,
				bodyData.message,
				tenantCode
			)
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'CONNECTION_REQUEST_SEND_SUCCESSFULLY',
				result: friendRequestResult,
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'CONNECTION_REQUEST_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			console.error(error)
			throw error
		}
	}

	/**
	 * Get information about the connection between two users.
	 * @param {string} friendId - The ID of the friend or target user.
	 * @param {string} userId - The ID of the authenticated user.
	 * @returns {Promise<Object>} The connection details or appropriate error.
	 */
	static async getInfo(friendId, userId, tenantCode) {
		try {
			let connection = await connectionQueries.getConnection(userId, friendId, tenantCode)

			if (!connection) {
				// If no connection is found, check for pending requests
				connection = await connectionQueries.checkPendingRequest(userId, friendId, tenantCode)
			}

			if (!connection) {
				// If still no connection, check for the deleted request
				connection = await connectionQueries.getRejectedRequest(userId, friendId, tenantCode)
			}

			const defaults = await getDefaults()
			if (!defaults.orgCode)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			const [userExtensionsModelName, userDetails] = await Promise.all([
				userExtensionQueries.getModelName(),
				userExtensionQueries.getMenteeExtension(
					friendId,
					[
						'name',
						'user_id',
						'mentee_visibility',
						'organization_code',
						'designation',
						'area_of_expertise',
						'education_qualification',
						'custom_entity_text',
						'meta',
						'is_mentor',
						'experience',
						'image',
					],
					false,
					tenantCode
				),
			])

			if (connection?.status === common.CONNECTIONS_STATUS.BLOCKED || !userDetails) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'USER_NOT_FOUND',
				})
			}
			userDetails.image &&= (await userRequests.getDownloadableUrl(userDetails.image))?.result

			// Fetch entity types associated with the user
			let entityTypes = await entityTypeQueries.findUserEntityTypesAndEntities({
				status: 'ACTIVE',
				organization_code: {
					[Op.in]: [userDetails.organization_code, defaults.orgCode],
				},
				model_names: { [Op.contains]: [userExtensionsModelName] },
			})
			const validationData = removeDefaultOrgEntityTypes(entityTypes, userDetails.organization_code)
			const processedUserDetails = utils.processDbResponse(userDetails, validationData)

			if (!connection) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'CONNECTION_NOT_FOUND',
					result: { user_details: processedUserDetails },
				})
			}

			connection.user_details = processedUserDetails

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'CONNECTION_DETAILS',
				result: connection,
			})
		} catch (error) {
			console.error(error)
			throw error
		}
	}

	/**
	 * Get a list of pending connection requests for a user.
	 * @param {string} userId - The ID of the user.
	 * @param {number} pageNo - The page number for pagination.
	 * @param {number} pageSize - The number of records per page.
	 * @returns {Promise<Object>} The list of pending connection requests.
	 */
	static async pending(userId, pageNo, pageSize, tenantCode) {
		try {
			const connections = await connectionQueries.getPendingRequests(userId, pageNo, pageSize, tenantCode)

			if (connections.count == 0 || connections.rows.length == 0) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'CONNECTION_LIST',
					result: {
						data: [],
						count: connections.count,
					},
				})
			}

			// Map friend details by user IDs
			const friendIds = connections.rows.map((connection) => connection.friend_id)
			let friendDetails = await userExtensionQueries.getUsersByUserIds(
				friendIds,
				{
					attributes: [
						'name',
						'user_id',
						'mentee_visibility',
						'organization_code',
						'designation',
						'area_of_expertise',
						'education_qualification',
						'custom_entity_text',
						'meta',
						'experience',
						'is_mentor',
						'image',
					],
				},
				tenantCode,
				false
			)

			const userExtensionsModelName = await userExtensionQueries.getModelName()

			const defaults = await getDefaults()
			if (!defaults.tenantCode)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			const uniqueOrgCodes = [...new Set(friendDetails.map((obj) => obj.organization_code))]
			friendDetails = await entityTypeService.processEntityTypesToAddValueLabels(
				friendDetails,
				uniqueOrgCodes,
				userExtensionsModelName,
				'organization_code',
				[],
				tenantCode
			)

			const friendDetailsMap = friendDetails.reduce((acc, friend) => {
				acc[friend.user_id] = friend
				return acc
			}, {})

			let connectionsWithDetails = connections.rows.map((connection) => {
				return {
					...connection,
					user_details: friendDetailsMap[connection.friend_id] || null,
				}
			})

			const userIds = connectionsWithDetails.map((item) => item.friend_id)
			const userDetails = await userRequests.getUserDetailedList(userIds, tenantCode)
			const userDetailsMap = new Map(
				userDetails.result.map((userDetail) => [String(userDetail.user_id), userDetail])
			)
			connectionsWithDetails = connectionsWithDetails.filter((connectionsWithDetail) => {
				const user_id = String(connectionsWithDetail.friend_id)

				if (userDetailsMap.has(user_id)) {
					const userDetail = userDetailsMap.get(user_id)
					if (userDetail && connectionsWithDetail.user_details) {
						connectionsWithDetail.user_details.image = userDetail.image
						return true
					}
				}
				return false
			})

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'CONNECTION_LIST',
				result: { data: connectionsWithDetails, count: connections.count },
			})
		} catch (error) {
			console.error(error)
			throw error
		}
	}

	/**
	 * Accept a pending connection request.
	 * @param {Object} bodyData - The body data containing the target user ID.
	 * @param {string} bodyData.user_id - The ID of the target user.
	 * @param {string} userId - The ID of the authenticated user.
	 * @returns {Promise<Object>} A success response indicating the request was accepted.
	 */
	static async accept(bodyData, userId, orgCode, tenantCode) {
		try {
			const connectionRequest = await this.checkConnectionRequestExists(userId, bodyData.user_id, tenantCode)
			if (!connectionRequest)
				return responses.failureResponse({
					message: 'CONNECTION_REQUEST_NOT_FOUND_OR_ALREADY_PROCESSED',
					statusCode: httpStatusCode.not_found,
					responseCode: 'CLIENT_ERROR',
				})

			await connectionQueries.approveRequest(userId, bodyData.user_id, connectionRequest.meta, tenantCode)

			const userDetails = await userExtensionQueries.getUsersByUserIds(
				[userId, bodyData.user_id],
				{
					attributes: ['settings', 'user_id'],
				},
				tenantCode,
				true
			)
			let chatRoom
			// Create room only if both users have enable chat option
			if (
				userDetails.length === 2 &&
				userDetails[0]?.settings?.chat_enabled === true &&
				userDetails[1]?.settings?.chat_enabled === true
			) {
				chatRoom = await communicationHelper.createChatRoom(
					userId,
					bodyData.user_id,
					connectionRequest.meta.message,
					tenantCode
				)
			}

			// Update connection meta with room_id if chatRoom was created
			const metaUpdate = chatRoom
				? { ...connectionRequest.meta, room_id: chatRoom.result.room.room_id }
				: connectionRequest.meta

			const updateConnection = await connectionQueries.updateConnection(
				userId,
				bodyData.user_id,
				{
					meta: metaUpdate,
				},
				tenantCode
			)

			await this.sendConnectionAcceptNotification(bodyData.user_id, userId, orgCode, tenantCode)

			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'CONNECTION_REQUEST_APPROVED',
				result: updateConnection,
			})
		} catch (error) {
			console.error(error)
			throw error
		}
	}

	/**
	 * Reject a pending connection request.
	 * @param {Object} bodyData - The body data containing the target user ID.
	 * @param {string} bodyData.user_id - The ID of the target user.
	 * @param {string} userId - The ID of the authenticated user.
	 * @returns {Promise<Object>} A success response indicating the request was rejected.
	 */
	static async reject(bodyData, userId, orgCode, tenantCode) {
		try {
			const connectionRequest = await this.checkConnectionRequestExists(userId, bodyData.user_id, tenantCode)
			if (!connectionRequest)
				return responses.failureResponse({
					message: 'CONNECTION_REQUEST_NOT_FOUND_OR_ALREADY_PROCESSED',
					statusCode: httpStatusCode.not_found,
					responseCode: 'CLIENT_ERROR',
				})

			const [rejectedCount, rejectedData] = await connectionQueries.rejectRequest(
				userId,
				bodyData.user_id,
				tenantCode
			)

			if (rejectedCount == 0) {
				return responses.failureResponse({
					message: 'CONNECTION_REQUEST_NOT_FOUND_OR_ALREADY_PROCESSED',
					statusCode: httpStatusCode.not_found,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Send notification to the mentee who requested the connection
			await this.sendConnectionRejectionNotification(bodyData.user_id, userId, orgCode, tenantCode)

			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'CONNECTION_REQUEST_REJECTED',
			})
		} catch (error) {
			console.error(error)
			throw error
		}
	}

	/**
	 * Fetch a list of connections based on query parameters and filters.
	 * @param {number} pageNo - The page number for pagination.
	 * @param {number} pageSize - The number of records per page.
	 * @param {string} searchText - The search text to filter results.
	 * @param {Object} queryParams - The query parameters for filtering.
	 * @param {string} userId - The ID of the authenticated user.
	 * @param {string} orgCode - The organization ID for filtering.
	 * @returns {Promise<Object>} A list of filtered connections.
	 */
	static async list(pageNo, pageSize, searchText, queryParams, userId, orgCode, tenantCode) {
		try {
			let organizationCodes = []

			if (queryParams.organization_codes) {
				organizationCodes = queryParams.organization_codes.split(',')
			}

			const query = utils.processQueryParametersWithExclusions(queryParams)
			const userExtensionsModelName = await userExtensionQueries.getModelName()

			const defaults = await getDefaults()
			if (!defaults.tenantCode)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			// Fetch validation data for filtering connections (excluding roles)
			const validationData = await entityTypeQueries.findAllEntityTypesAndEntities(
				{
					status: 'ACTIVE',
					allow_filtering: true,
					model_names: { [Op.contains]: [userExtensionsModelName] },
				},
				{ [Op.in]: [defaults.tenantCode, tenantCode] }
			)

			const filteredQuery = utils.validateAndBuildFilters(query, validationData, userExtensionsModelName)

			let roles = []
			if (queryParams.roles) {
				roles = queryParams.roles.split(',')
			}

			let extensionDetails = await connectionQueries.getConnectionsDetails(
				pageNo,
				pageSize,
				filteredQuery,
				searchText,
				userId,
				organizationCodes,
				roles,
				tenantCode
			)

			if (extensionDetails.count === 0 || extensionDetails.data.length === 0) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'CONNECTED_USERS_FETCHED',
					result: {
						data: [],
						count: extensionDetails.count,
					},
				})
			}

			if (extensionDetails.data.length > 0) {
				const uniqueOrgCodes = [...new Set(extensionDetails.data.map((obj) => obj.organization_code))]

				extensionDetails.data = await entityTypeService.processEntityTypesToAddValueLabels(
					extensionDetails.data,
					uniqueOrgCodes,
					userExtensionsModelName,
					'organization_code',
					[],
					tenantCode
				)
			}
			const userIds = extensionDetails.data.map((item) => item.user_id)
			const userDetails = await userRequests.getUserDetailedList(userIds, tenantCode)
			const userDetailsMap = new Map(
				userDetails.result.map((userDetail) => [String(userDetail.user_id), userDetail])
			)
			extensionDetails.data = extensionDetails.data.filter((extensionDetail) => {
				const user_id = String(extensionDetail.user_id)
				if (userDetailsMap.has(user_id)) {
					const userDetail = userDetailsMap.get(user_id)
					extensionDetail.image = userDetail.image
					return true
				}
				return false
			})

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'CONNECTED_USERS_FETCHED',
				result: extensionDetails,
			})
		} catch (error) {
			console.error('Error in list function:', error)
			throw error
		}
	}

	/**
	 * Send email notification to mentee when connection request is rejected
	 * @param {string} menteeId - ID of the mentee who sent the connection request
	 * @param {string} mentorId - ID of the mentor who rejected the request
	 * @param {string} orgCode - Organization ID
	 */
	static async sendConnectionRejectionNotification(menteeId, mentorId, orgCode, tenantCode) {
		try {
			const templateCode = process.env.CONNECTION_REQUEST_REJECTION_EMAIL_TEMPLATE
			if (!templateCode) {
				console.log('CONNECTION_REQUEST_REJECTION_EMAIL_TEMPLATE not configured, skipping notification')
				return
			}

			// Get mentee details
			const menteeDetails = await userExtensionQueries.getUsersByUserIds(
				[menteeId],
				{
					attributes: ['name', 'email', 'user_id'],
				},
				false,
				tenantCode
			)

			// Get mentor details
			const mentorDetails = await mentorExtensionQueries.getMentorExtension(mentorId, ['name'], true, tenantCode)

			if (!menteeDetails || menteeDetails.length === 0 || !mentorDetails) {
				console.log('Unable to fetch user details for connection rejection notification')
				return
			}

			// Get email template
			const templateData = await notificationQueries.findOneEmailTemplate(
				templateCode,
				orgCode.toString(),
				tenantCode
			)

			if (templateData) {
				const menteeName = menteeDetails[0].name
				const mentorName = mentorDetails.name

				// Create email payload
				const payload = {
					type: 'email',
					email: {
						to: menteeDetails[0].email,
						subject: templateData.subject,
						body: utils.composeEmailBody(templateData.body, {
							menteeName: menteeName,
							mentorName: mentorName,
						}),
					},
				}

				console.log('CONNECTION REJECTION EMAIL PAYLOAD: ', payload)
				await kafkaCommunication.pushEmailToKafka(payload)
			} else {
				console.log(`Email template not found for code: ${templateCode}`)
			}
		} catch (error) {
			console.error('Error sending connection rejection notification:', error)
			// Don't throw error to avoid breaking the main rejection flow
		}
	}

	/**
	 * @name sendConnectionAcceptNotification
	 * Send email notification to mentee when connection request is accepted
	 * @param {string} menteeId - ID of the mentee who sent the connection request
	 * @param {string} mentorId - ID of the mentor who accepted the request
	 * @param {string} orgCode - Organization ID
	 */
	static async sendConnectionAcceptNotification(menteeId, mentorId, orgCode, tenantCode) {
		try {
			const templateCode = process.env.CONNECTION_REQUEST_ACCEPT_EMAIL_TEMPLATE
			if (!templateCode) {
				console.log('CONNECTION_REQUEST_ACCEPT_EMAIL_TEMPLATE not configured, skipping notification')
				return
			}

			// Get mentee details
			const menteeDetails = await userExtensionQueries.getUsersByUserIds(
				[menteeId],
				{
					attributes: ['name', 'email', 'user_id'],
				},
				false,
				tenantCode
			)

			// Get mentor details
			const mentorDetails = await mentorExtensionQueries.getMentorExtension(mentorId, ['name'], true, tenantCode)

			if (!menteeDetails || menteeDetails.length === 0 || !mentorDetails) {
				console.log('Unable to fetch user details for connection rejection notification')
				return
			}

			// Get email template
			const templateData = await notificationQueries.findOneEmailTemplate(
				templateCode,
				orgCode.toString(),
				tenantCode
			)

			if (templateData) {
				const menteeName = menteeDetails[0].name
				const mentorName = mentorDetails.name

				// Create email payload
				const payload = {
					type: 'email',
					email: {
						to: menteeDetails[0].email,
						subject: templateData.subject,
						body: utils.composeEmailBody(templateData.body, {
							menteeName: menteeName,
							mentorName: mentorName,
						}),
					},
				}

				console.log('CONNECTION ACCEPT EMAIL PAYLOAD: ', payload)
				await kafkaCommunication.pushEmailToKafka(payload)
			} else {
				console.log(`Email template not found for code: ${templateCode}`)
			}
		} catch (error) {
			console.error('Error sending connection accept notification:', error)
			// Don't throw error to avoid breaking the main rejection flow
		}
	}
}
