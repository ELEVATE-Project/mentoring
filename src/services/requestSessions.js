const connectionQueries = require('@database/queries/connection')
const sessionRequestQueries = require('@database/queries/requestSessions')
const sessionRequestMappingQueries = require('@database/queries/requestSessionMapping')
const moment = require('moment-timezone')
const userExtensionQueries = require('@database/queries/userExtension')
const common = require('@constants/common')
const responses = require('@helpers/responses')
const httpStatusCode = require('@generics/http-status')
const notificationQueries = require('@database/queries/notificationTemplate')
const entityTypeService = require('@services/entity-type')
const userRequests = require('@requests/user')
const sessionService = require('@services/sessions')
const mentorExtensionQueries = require('@database/queries/mentorExtension')
const utils = require('@generics/utils')
const kafkaCommunication = require('@generics/kafka-communication')
const { getDefaultOrgId } = require('@helpers/getDefaultOrgId')
const entityTypeQueries = require('@database/queries/entityType')
const { Op } = require('sequelize')
const { removeDefaultOrgEntityTypes } = require('@generics/utils')
const menteeServices = require('@services/mentees')
const mentorService = require('@services/mentors')
const mentorQueries = require('@database/queries/mentorExtension')
const schedulerRequest = require('@requests/scheduler')
const communicationHelper = require('@helpers/communications')

module.exports = class requestSessionsHelper {
	static async checkConnectionRequestExists(userId, targetUserId) {
		const connectionRequest = await connectionQueries.findOneRequest(userId, targetUserId)
		if (!connectionRequest) {
			return false
		}
		return connectionRequest
	}

	/**
	 * Initiates a session request between two users.
	 * @param {Object} bodyData - The request body requesting session related information.
	 * @param {string} bodyData.requestee_id - The ID of the target user.
	 * @param {string} userId - The ID of the user initiating the request.
	 * @returns {Promise<Object>} A success or failure response.
	 */

	static async create(bodyData, userId, orgId, skipValidation) {
		try {
			const mentorUserExists = await mentorQueries.getMentorExtension(bodyData.requestee_id)
			if (!mentorUserExists) {
				return responses.failureResponse({
					statusCode: httpStatusCode.not_found,
					message: 'USER_NOT_FOUND',
				})
			}

			// Check if a connection already exists between the users
			const connectionExists = await connectionQueries.getConnection(userId, bodyData.requestee_id)

			// If not connected, restrict mentee to a single pending request
			if (!connectionExists) {
				const pendingRequest = await sessionRequestQueries.checkPendingRequest(userId, bodyData.requestee_id)
				if (pendingRequest.count > 0) {
					return responses.failureResponse({
						statusCode: httpStatusCode.bad_request,
						message: 'SESSION_REQUEST_PENDING',
					})
				}
			}

			if (userId == bodyData.requestee_id) {
				return responses.failureResponse({
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
					message: 'SELF_MENTOR',
				})
			}

			// Calculate duration of the session
			let duration = moment.duration(moment.unix(bodyData.end_date).diff(moment.unix(bodyData.start_date)))
			let elapsedMinutes = duration.asMinutes()

			// Based on session duration check recommended conditions
			if (elapsedMinutes < 30) {
				return responses.failureResponse({
					message: 'BELOW_MINIMUM_SESSION_TIME',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			if (elapsedMinutes > 1440) {
				return responses.failureResponse({
					message: 'EXCEEDED_MAXIMUM_SESSION_TIME',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			const maxAllowedDate = moment().add(process.env.LIMIT_FOR_SESSION_REQUEST_MONTH, 'months')
			const sessionStartDate = moment.unix(bodyData.start_date)
			const sessionEndDate = moment.unix(bodyData.end_date)

			if (sessionStartDate.isAfter(maxAllowedDate) || sessionEndDate.isAfter(maxAllowedDate)) {
				const errorMessage = {
					key: 'DATE_EXCEEDS_ALLOWED_RANGE',
					interpolation: { limitedTime: process.env.LIMIT_FOR_SESSION_REQUEST_MONTH },
				}
				return responses.failureResponse({
					message: errorMessage,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Get default org id and entities
			const defaultOrgId = await getDefaultOrgId()
			if (!defaultOrgId)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_ID_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			const requestSessionModelName = await sessionRequestQueries.getModelName()
			const entityTypes = await entityTypeQueries.findUserEntityTypesAndEntities({
				status: 'ACTIVE',
				organization_id: {
					[Op.in]: [orgId, defaultOrgId],
				},
				model_names: { [Op.contains]: [requestSessionModelName] },
			})

			const validationData = removeDefaultOrgEntityTypes(entityTypes, orgId)
			let res = utils.validateInput(bodyData, validationData, requestSessionModelName, skipValidation)
			if (!res.success) {
				return responses.failureResponse({
					message: 'REQUEST_SESSION_CREATION_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
					result: res.errors,
				})
			}

			let requestSessionModel = await sessionRequestQueries.getColumns()
			bodyData = utils.restructureBody(bodyData, validationData, requestSessionModel)

			// Create a new session request
			const SessionRequestResult = await sessionRequestQueries.addSessionRequest(
				userId,
				bodyData.requestee_id,
				bodyData.agenda,
				bodyData.start_date,
				bodyData.end_date,
				bodyData.title,
				bodyData.meta ? bodyData.meta : null
			)

			const SessionRequestMapping = await sessionRequestMappingQueries.addSessionRequest(
				bodyData.requestee_id,
				SessionRequestResult.id
			)

			// Schedule a job to expire the session request after end_date
			const jobId = common.expireSessionRequest + SessionRequestResult.id

			const delay = await utils.getTimeDifferenceInMilliseconds(bodyData.end_date, 0, 'minutes')

			const reqBody = {
				job_id: jobId,
				request_session_id: SessionRequestResult.id,
			}

			const expire = await schedulerRequest.createSchedulerJob(
				jobId,
				delay,
				'ExpireSessionRequest',
				reqBody,
				`${common.expireSessionRequestEndpoint}/${SessionRequestResult.id}`,
				common.POST_METHOD
			)

			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'SESSION_REQUEST_SENT_SUCCESSFULLY',
				result: SessionRequestResult,
			})
		} catch (error) {
			console.error(error)
			throw error
		}
	}

	/**
	 * Get a list of pending session requests for a user.
	 * @param {string} userId - The ID of the user.
	 * @param {number} pageNo - The page number for pagination.
	 * @param {number} pageSize - The number of records per page.
	 * @returns {Promise<Object>} The list of pending session requests.
	 */
	static async list(userId, pageNo, pageSize, status) {
		try {
			const allRequestSession = await sessionRequestQueries.getAllRequests(userId, status)
			const sessionRequestData = allRequestSession.rows

			const sessionRequestMapping = await sessionRequestMappingQueries.getSessionsMapping(userId)
			const sessionRequestIds = sessionRequestMapping.map((s) => s.request_session_id)

			const sessionMappingDetails = await sessionRequestQueries.getSessionMappingDetails(
				sessionRequestIds,
				status
			)
			const sessionMappingDetailsData = sessionMappingDetails.map((s) => s.dataValues)

			const combinedData = [...sessionRequestData, ...sessionMappingDetailsData]

			// Sort combined data by created_at in descending order (most recent first)
			combinedData.sort((a, b) => {
				const dateA = new Date(a.created_at)
				const dateB = new Date(b.created_at)
				return dateB - dateA // Descending order
			})

			const totalCount = combinedData.length

			let paginatedData = combinedData
			if (pageNo && pageSize) {
				const offset = (pageNo - 1) * pageSize
				paginatedData = combinedData.slice(offset, offset + pageSize)
			}

			if (!paginatedData.length) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'SESSION_REQUESTS_LIST',
					result: { data: [], count: 0 },
				})
			}

			const oppositeUserIds = paginatedData.map((s) =>
				s.requestor_id === userId ? s.requestee_id : s.requestor_id
			)

			let oppositeUserDetails = await userExtensionQueries.getUsersByUserIds(oppositeUserIds, {
				attributes: ['user_id', 'image', 'name', 'experience', 'designation', 'organization_id'],
			})

			const uniqueOrgIds = [...new Set(oppositeUserDetails.map((u) => u.organization_id))]
			const modelName = await userExtensionQueries.getModelName()

			oppositeUserDetails = await entityTypeService.processEntityTypesToAddValueLabels(
				oppositeUserDetails,
				uniqueOrgIds,
				modelName,
				'organization_id'
			)

			const userDetailsMap = Object.fromEntries(oppositeUserDetails.map((u) => [u.user_id, u]))
			const userIds = oppositeUserIds.map((id) => String(id))

			const userDetails = await userExtensionQueries.getUsersByUserIds(userIds, {}, true)

			await Promise.all(
				userDetails.map(async (u) => {
					if (u.image) u.image = await utils.getDownloadableUrl(u.image)
				})
			)

			const fullMap = new Map(userDetails.map((u) => [String(u.user_id), u]))

			const data = paginatedData
				.map((session) => {
					const isSent = session.requestor_id === userId
					const oppositeUserId = isSent ? session.requestee_id : session.requestor_id
					const user = userDetailsMap[oppositeUserId]
					const fullUser = fullMap.get(String(oppositeUserId))

					if (user && fullUser) {
						user.image = fullUser.image
						return {
							...session,
							id: String(session.id),
							user_details: user,
							request_type: isSent ? 'sent' : 'received',
						}
					}
					return null
				})
				.filter(Boolean)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'SESSION_REQUESTS_LIST',
				result: {
					data,
					count: totalCount,
				},
			})
		} catch (error) {
			console.error(error)
			throw error
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
	static async accept(bodyData, mentorUserId, orgId, isMentor) {
		try {
			// Fetch session request details
			const getRequestSessionDetails = await sessionRequestQueries.findOneRequest(bodyData.request_session_id)

			// If no session request found
			if (!getRequestSessionDetails) {
				return responses.failureResponse({
					statusCode: httpStatusCode.not_found,
					responseCode: 'CLIENT_ERROR',
					message: 'SESSION_REQUEST_NOT_FOUND',
				})
			}

			// Prevent mentor accepting their own session request
			if (mentorUserId == getRequestSessionDetails.requestor_id) {
				return responses.failureResponse({
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
					message: 'MENTOR_CANNOT_ACCEPT_OWN_REQUEST',
				})
			}

			// Map session data
			Object.assign(bodyData, {
				type: common.SESSION_TYPE.PRIVATE,
				mentor_id: mentorUserId,
				mentees: [getRequestSessionDetails.requestor_id],
				description: getRequestSessionDetails.agenda,
				title: getRequestSessionDetails.title,
				start_date: getRequestSessionDetails.start_date,
				end_date: getRequestSessionDetails.end_date,
				meta: getRequestSessionDetails.meta || null,
			})

			// Create session
			const sessionCreation = await sessionService.create(bodyData, mentorUserId, orgId, isMentor, true, true)

			// If session creation fails
			if (sessionCreation.statusCode !== httpStatusCode.created) {
				return responses.failureResponse({
					statusCode: sessionCreation.statusCode || httpStatusCode.bad_request,
					message: sessionCreation.message || 'SESSION_CREATION_FAILED',
					data: sessionCreation.data || [],
				})
			}

			// Approve session request
			const approveSessionRequest = await sessionRequestQueries.approveRequest(
				mentorUserId,
				bodyData.request_session_id,
				sessionCreation.result.id
			)

			// If approval failed
			if (
				!Array.isArray(approveSessionRequest) ||
				!approveSessionRequest.length ||
				approveSessionRequest[0]?.dataValues?.status !== common.CONNECTIONS_STATUS.ACCEPTED
			) {
				return responses.failureResponse({
					statusCode: httpStatusCode.bad_request,
					message: 'SESSION_APPROVAL_FAILED',
					data: [],
				})
			}

			// Check if mentee user exists
			const userExists = await userExtensionQueries.getMenteeExtension(getRequestSessionDetails.requestor_id)
			if (!userExists) {
				return responses.failureResponse({
					statusCode: httpStatusCode.not_found,
					message: 'USER_NOT_FOUND',
				})
			}

			// Check if connection already exists
			let connectionExists = await connectionQueries.getConnection(
				mentorUserId,
				getRequestSessionDetails.requestor_id
			)

			// If no connection, create one
			if (!connectionExists) {
				// Check for pending connection request
				let connectionRequest = await this.checkConnectionRequestExists(
					mentorUserId,
					getRequestSessionDetails.requestor_id
				)

				// If no pending request, send a new request
				if (!connectionRequest) {
					await connectionQueries.addFriendRequest(
						getRequestSessionDetails.requestor_id,
						mentorUserId,
						common.CONNECTIONS_DEFAULT_MESSAGE
					)

					// Re-check connection request after creating
					connectionRequest = await this.checkConnectionRequestExists(
						mentorUserId,
						getRequestSessionDetails.requestor_id
					)
				}

				// Approve connection request
				await connectionQueries.approveRequest(
					mentorUserId,
					getRequestSessionDetails.requestor_id,
					connectionRequest?.meta
				)

				// Fetch user chat settings
				const userDetails = await userExtensionQueries.getUsersByUserIds(
					[mentorUserId, getRequestSessionDetails.requestor_id],
					{ attributes: ['settings', 'user_id'] },
					true
				)

				const bothChatEnabled =
					userDetails.length === 2 &&
					userDetails[0]?.settings?.chat_enabled === true &&
					userDetails[1]?.settings?.chat_enabled === true

				let chatRoom = null

				// If both users have chat enabled, create chat room
				if (bothChatEnabled) {
					chatRoom = await communicationHelper.createChatRoom(
						mentorUserId,
						getRequestSessionDetails.requestor_id,
						connectionRequest?.meta?.message
					)
				}

				// Update connection with chat room ID if created
				const updatedMeta = chatRoom
					? { ...connectionRequest?.meta, room_id: chatRoom.result.room.room_id }
					: connectionRequest?.meta

				await connectionQueries.updateConnection(getRequestSessionDetails.requestor_id, mentorUserId, {
					meta: updatedMeta,
				})
			}

			// Send Email
			const templateCode = process.env.MENTOR_ACCEPT_SESSION_REQUEST_EMAIL_TEMPLATE
			if (templateCode) {
				emailForAcceptAndReject(
					templateCode,
					orgId.toString(),
					getRequestSessionDetails.requestor_id,
					mentorUserId
				)
			}

			// Return Success
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: !connectionExists ? 'SESSION_REQUEST_APPROVED_AND_CONNECTED' : 'SESSION_REQUEST_APPROVED',
				result: approveSessionRequest[0]?.dataValues?.status,
				interpolation: !connectionExists
					? { MenteeName: userExists.name } // Pass your dynamic value here
					: undefined,
			})
		} catch (error) {
			console.error(error)
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
	static async reject(bodyData, userId, orgId) {
		try {
			// Fetch session request details
			const getRequestSessionDetails = await sessionRequestQueries.findOneRequest(bodyData.request_session_id)

			// If no session request found
			if (!getRequestSessionDetails) {
				return responses.failureResponse({
					statusCode: httpStatusCode.not_found,
					responseCode: 'CLIENT_ERROR',
					message: 'SESSION_REQUEST_NOT_FOUND',
				})
			}

			const [rejectedCount, rejectedData] = await sessionRequestQueries.rejectRequest(
				userId,
				bodyData.request_session_id,
				bodyData.reason
			)

			if (rejectedCount == 0) {
				return responses.failureResponse({
					message: 'SESSION_REQUEST_NOT_FOUND_OR_ALREADY_PROCESSED',
					statusCode: httpStatusCode.not_found,
					responseCode: 'CLIENT_ERROR',
				})
			}

			const templateCode = process.env.MENTOR_REJECT_SESSION_REQUEST_EMAIL_TEMPLATE
			emailForAcceptAndReject(
				templateCode,
				orgId.toString(),
				rejectedData[0].dataValues.requestor_id,
				userId,
				bodyData.reason
			)

			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'SESSION_REQUEST_REJECTED',
			})
		} catch (error) {
			console.error(error)
			throw error
		}
	}

	/**
	 * Get information about a session between the authenticated user and another user.
	 * @param {Object} req - The request object.
	 * @param {Object} req.body - The body of the request.
	 * @param {string} req.body.user_id - The ID of the user to get connection info for.
	 * @param {Object} req.decodedToken - The decoded token containing authenticated user info.
	 * @param {string} req.decodedToken.id - The ID of the authenticated user.
	 * @returns {Promise<Object>} The session information.
	 * @throws Will throw an error if the request fails.
	 */
	static async getInfo(requestSessionId, userId) {
		try {
			const requestSessions = await sessionRequestQueries.getRequestSessions(requestSessionId, userId)

			const defaultOrgId = await getDefaultOrgId()
			if (!defaultOrgId) {
				return responses.failureResponse({
					message: 'DEFAULT_ORG_ID_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			const targetUserId =
				userId === requestSessions.requestee_id ? requestSessions.requestor_id : requestSessions.requestee_id

			const [userExtensionsModelName, userDetails] = await Promise.all([
				userExtensionQueries.getModelName(),
				userExtensionQueries.getMenteeExtension(targetUserId, [
					'name',
					'user_id',
					'mentee_visibility',
					'organization_id',
					'designation',
					'area_of_expertise',
					'education_qualification',
					'custom_entity_text',
					'meta',
					'is_mentor',
					'experience',
					'image',
				]),
			])

			if (requestSessions?.status === common.CONNECTIONS_STATUS.BLOCKED || !userDetails) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'USER_NOT_FOUND',
				})
			}
			if (userDetails.image) {
				const imageData = await userRequests.getDownloadableUrl(userDetails.image)
				userDetails.image = imageData?.result
			}

			// Fetch entity types associated with the user
			let entityTypes = await entityTypeQueries.findUserEntityTypesAndEntities({
				status: 'ACTIVE',
				organization_id: {
					[Op.in]: [userDetails.organization_id, defaultOrgId],
				},
				model_names: { [Op.contains]: [userExtensionsModelName] },
			})
			const validationData = removeDefaultOrgEntityTypes(entityTypes, userDetails.organization_id)
			const processedUserDetails = utils.processDbResponse(userDetails, validationData)

			if (!requestSessions) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'REQUEST_SESSION_NOT_FOUND',
					result: { user_details: processedUserDetails },
				})
			}

			requestSessions.user_details = processedUserDetails
			requestSessions.id = requestSessions.id?.toString() // Convert ID to string

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'REQUEST_SESSION_DETAILS',
				result: requestSessions,
			})
		} catch (error) {
			console.error(error)
			throw error
		}
	}

	static async userAvailability(userId, page, limit, search, status, roles, startDate, endDate) {
		try {
			// Fetch both mentor and mentee sessions in parallel
			const [enrolledSessions, mentoringSessions] = await Promise.all([
				menteeServices.getMySessions(page, limit, search, userId, startDate, endDate),
				mentorService.createdSessions(userId, page, limit, search, status, roles, startDate, endDate),
			])

			// Merge the two session arrays into one
			const allSessions = [...(mentoringSessions?.result?.data || []), ...(enrolledSessions?.rows || [])]

			// Generate combined availability
			const availability = createMentorAvailabilityResponse(allSessions)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'MENTOR_AVAILABILITY',
				result: availability.result,
			})
		} catch (error) {
			return error
		}
	}

	static async expire(requestSessionId) {
		try {
			// Fetch session request details
			const getRequestSessionDetails = await sessionRequestQueries.findOneRequest(requestSessionId)

			// If no session request found
			if (!getRequestSessionDetails) {
				return responses.failureResponse({
					statusCode: httpStatusCode.not_found,
					responseCode: 'CLIENT_ERROR',
					message: 'SESSION_REQUEST_NOT_FOUND',
				})
			}

			const [expiredCount, expiredData] = await sessionRequestQueries.expireRequest(requestSessionId)

			if (expiredCount == 0) {
				return responses.failureResponse({
					message: 'SESSION_REQUEST_NOT_FOUND_OR_ALREADY_PROCESSED',
					statusCode: httpStatusCode.not_found,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'SESSION_REQUEST_EXPIRED',
			})
		} catch (error) {
			console.error(error)
			throw error
		}
	}
}

function createMentorAvailabilityResponse(data) {
	const availability = {}

	data.forEach((session) => {
		const startDateMoment = moment.unix(Number(session.start_date))
		const endDateMoment = moment.unix(Number(session.end_date))
		const dateKey = startDateMoment.format('YYYY-MM-DD')

		const timeSlot = {
			startTime: session.start_date,
			endTime: session.end_date,
			title: session.title || '',
		}

		if (!availability[dateKey]) {
			availability[dateKey] = []
		}

		availability[dateKey].push(timeSlot)
	})

	const resultData = Object.keys(availability).map((date) => {
		return {
			date: date,
			bookedSlots: availability[date],
		}
	})

	return {
		result: resultData,
	}
}

async function emailForAcceptAndReject(templateCode, orgId, requestor_id, mentorUserId, rejectReason = '') {
	const menteeDetails = await userExtensionQueries.getUsersByUserIds(requestor_id, {
		attributes: ['name', 'email'],
	})

	const mentorDetails = await mentorExtensionQueries.getMentorExtension(mentorUserId, ['name'], true)

	let emailTemplateCode

	//assign template data
	emailTemplateCode = templateCode

	// send mail to mentors on session creation if session created by manager
	const templateData = await notificationQueries.findOneEmailTemplate(emailTemplateCode, orgId)

	// If template data is available. create mail data and push to kafka
	if (templateData) {
		let name = menteeDetails[0].name
		// Push successful enrollment to session in kafka
		const payload = {
			type: 'email',
			email: {
				to: menteeDetails[0].email,
				subject: templateData.subject,
				body: utils.composeEmailBody(templateData.body, {
					name: name,
					mentorName: mentorDetails.name,
					reason: rejectReason,
				}),
			},
		}
		console.log('EMAIL PAYLOAD: ', payload)
		await kafkaCommunication.pushEmailToKafka(payload)
	}
}
