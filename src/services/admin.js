const common = require('@constants/common')
const httpStatusCode = require('@generics/http-status')
const utils = require('@generics/utils')
const kafkaCommunication = require('@generics/kafka-communication')
const sessionQueries = require('@database/queries/sessions')
const sessionAttendeesQueries = require('@database/queries/sessionAttendees')
const notificationTemplateQueries = require('@database/queries/notificationTemplate')
const mentorQueries = require('@database/queries/mentorExtension')
const menteeQueries = require('@database/queries/userExtension')
const adminService = require('../generics/materializedViews')
const responses = require('@helpers/responses')
// Removed direct import to break circular dependency - using direct query instead
const requestSessionQueries = require('@database/queries/requestSessions')
const userRequests = require('@requests/user')
const mentorExtensionQueries = require('@database/queries/mentorExtension')
const organisationExtensionQueries = require('@database/queries/organisationExtension')
const communicationHelper = require('@helpers/communications')
const moment = require('moment')
const connectionQueries = require('@database/queries/connection')
const userExtensionQueries = require('@database/queries/userExtension')
const { getDefaults } = require('@helpers/getDefaultOrgId')
const { sequelize } = require('@database/models/index')
const { literal } = require('sequelize')
const sessionOwnerships = require('@database/queries/sessionOwnership')

// Generic notification helper class
class NotificationHelper {
	static async sendGenericNotification({
		recipients,
		templateCode,
		orgCode,
		templateData = {},
		subjectData = {},
		tenantCodes,
	}) {
		try {
			if (!templateCode || !recipients?.length) {
				console.log('Missing template code or recipients for notification')
				return true
			}

			const template = await notificationTemplateQueries.findOneEmailTemplate(templateCode, orgCode, tenantCodes)
			if (!template) {
				console.log(`Template ${templateCode} not found`)
				return true
			}

			const emailPromises = recipients.map(async (recipient) => {
				const payload = {
					type: 'email',
					email: {
						to: recipient.email,
						subject: utils.composeEmailBody(template.subject, {
							...subjectData,
							recipientName: recipient.name,
						}),
						body: utils.composeEmailBody(template.body, { ...templateData, recipientName: recipient.name }),
					},
				}
				await kafkaCommunication.pushEmailToKafka(payload)
			})

			await Promise.all(emailPromises)
			console.log(`Sent ${recipients.length} notifications using template ${templateCode}`)
			return true
		} catch (error) {
			console.error(`Error sending generic notification (${templateCode}):`, error)
			return false
		}
	}

	static async sendSessionNotification({
		sessions,
		templateCode,
		orgCode,
		recipientField = 'mentee_id',
		addionalData = {},
		tenantCode,
	}) {
		try {
			if (!sessions?.length || !templateCode) return true

			const template = await notificationTemplateQueries.findOneEmailTemplate(templateCode, orgCode, tenantCode)
			if (!template) {
				console.log(`Template ${templateCode} not found`)
				return true
			}

			for (const session of sessions) {
				const recipientIds =
					recipientField === 'attendees'
						? await this.getSessionAttendeeIds(session.id, tenantCode)
						: [session[recipientField]]

				const recipients = await menteeQueries.getUsersByUserIds(recipientIds, {}, tenantCode, true)

				const emailPromises = recipients.map(async (recipient) => {
					const templateData = {
						sessionName: session.title,
						sessionDate: session.start_date ? moment.unix(session.start_date).format('DD-MM-YYYY') : '',
						sessionTime: session.start_date ? moment.unix(session.start_date).format('hh:mm A') : '',
						recipientName: recipient.name,
						attendeeName: recipient.name,
						...addionalData,
					}

					const payload = {
						type: 'email',
						email: {
							to: recipient.email,
							subject: utils.composeEmailBody(template.subject, templateData),
							body: utils.composeEmailBody(template.body, templateData),
						},
					}
					await kafkaCommunication.pushEmailToKafka(payload)
				})

				await Promise.all(emailPromises)
			}

			return true
		} catch (error) {
			console.error(`Error sending session notification (${templateCode}):`, error)
			return false
		}
	}

	static async getSessionAttendeeIds(sessionId, tenantCode) {
		try {
			const attendees = await sessionAttendeesQueries.findAll({ session_id: sessionId }, tenantCode)
			return attendees.map((attendee) => attendee.mentee_id)
		} catch (error) {
			console.error('Error getting session attendee IDs:', error)
			return []
		}
	}
}

module.exports = class AdminService {
	/**
	 * userDelete
	 * @method
	 * @name userDelete
	 * @param {userId} userId - UserId of the user that needs to be deleted
	 * @returns {JSON} - List of users
	 */

	static async userDelete(userId, tenantCode) {
		try {
			let result = {}

			// Step 1: Fetch user details
			const getUserDetails = await menteeQueries.getUsersByUserIds([userId], {}, tenantCode, false) // userId = "1"
			if (!getUserDetails || getUserDetails.length === 0) {
				return responses.failureResponse({
					statusCode: httpStatusCode.bad_request,
					message: 'USER_NOT_FOUND',
					result,
				})
			}

			const userInfo = getUserDetails[0]
			const isMentor = userInfo.is_mentor === true

			// Step 2: Check if user is a session manager
			const getUserDetailById = await userRequests.fetchUserDetails({ userId }) // userId = "1"
			const roleTitles = getUserDetailById?.data?.result?.user_roles?.map((r) => r.title) || []
			const isSessionManager = roleTitles.includes(common.SESSION_MANAGER_ROLE)

			// Step 3: Optional logic to mark Session Manager as UNDER_DELETION
			// const isAlreadyUnderDeletion = userInfo.status === common.UNDER_DELETION_STATUS;
			// if (isSessionManager) {
			// 	if (isAlreadyUnderDeletion) {
			// 		return responses.failureResponse({
			// 			statusCode: httpStatusCode.bad_request,
			// 			message: 'USER_ALREADY_UNDER_DELETION',
			// 			result,
			// 		});
			// 	}

			// 	const updateData = { status: common.UNDER_DELETION_STATUS };

			// 	if (isMentor) {
			// 		await mentorQueries.updateMentorExtension(userId, updateData, true);
			// 	} else {
			// 		await menteeQueries.updateMenteeExtension(userId, updateData, true);
			// 	}

			// 	return responses.successResponse({
			// 		statusCode: httpStatusCode.ok,
			// 		message: 'USER_UNDER_DELETION',
			// 		result,
			// 	});
			// }

			// Prevent deletion of session manager directly
			if (isSessionManager) {
				return responses.failureResponse({
					statusCode: httpStatusCode.bad_request,
					message: 'SESSION_MANAGER_DELETION_UNSUCCESSFUL',
					result,
				})
			}

			// Step 4: Check for user connections
			const connectionCount = await connectionQueries.getConnectionsCount('', userId, [], tenantCode) // filter, userId = "1", organizationIds = ["1", "2"]

			if (connectionCount > 0) {
				let mentorIds = await connectionQueries.getConnectedUsers(userId, 'user_id', 'friend_id', tenantCode)
				if (mentorIds.length === 0) {
					return []
				}
				// Get mentor details for notification
				const connectedMentors = await userExtensionQueries.getUsersByUserIds(mentorIds, {
					attributes: ['user_id', 'name', 'email'],
					tenantCode,
				})

				// Soft delete in communication service
				const removeChatUser = await communicationHelper.setActiveStatus(userId, false) // ( userId = "1", activeStatus = "true" or "false")
				const removeChatAvatar = await communicationHelper.removeAvatar(userId)

				// Update user name to 'User Not Found'
				const updateChatUserName = await communicationHelper.updateUser(userId, common.USER_NOT_FOUND) // userId: "1", name: "User Name"

				result.isChatUserRemoved = removeChatUser?.result?.success === true
				result.isRemoveChatAvatar = removeChatAvatar?.result?.success === true
				result.isChatNameUpdated = updateChatUserName?.result?.success === true

				// Delete user connections and requests from DB
				result.isConnectionsAndRequestsRemoved = await connectionQueries.deleteUserConnectionsAndRequests(
					userId,
					tenantCode
				) // userId = "1"

				// Notify connected mentors about mentee deletion
				if (connectedMentors.length > 0) {
					result.isMentorNotifiedAboutMenteeDeletion = await this.notifyMentorsAboutMenteeDeletion(
						connectedMentors,
						userInfo.name || 'User',
						userInfo.organization_code || '',
						tenantCode
					)
				} else {
					result.isMentorNotifiedAboutMenteeDeletion = true
				}
			} else {
				// No connections exist, set chat flags to true since no action needed
				result.isChatUserRemoved = true
				result.isChatNameUpdated = true
				result.isRemoveChatAvatar = true
				result.isConnectionsAndRequestsRemoved = true
				result.isMentorNotifiedAboutMenteeDeletion = true
			}

			// Step 5: Session Request Deletion & Notifications
			const requestSessions = await this.findAllRequestSessions(userId, tenantCode) // userId = "1"

			const defaults = await getDefaults()
			if (!defaults.orgCode)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			if (!defaults.tenantCode)
				return responses.failureResponse({
					message: 'DEFAULT_TENANT_CODE_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			if (requestSessions.allSessionRequestIds.length > 0) {
				const { allSessionRequestIds = [], requestedSessions = [], receivedSessions = [] } = requestSessions

				// Collect all session request IDs for deletion
				result.isRequestedSessionRemoved = await requestSessionQueries.markRequestsAsDeleted(
					allSessionRequestIds,
					tenantCode
				) // allSessionRequestIds = ["1", "2"]

				if (requestedSessions.length > 0) {
					result.isRequestedSessionMentorNotified = await this.NotifySessionRequestedUsers(
						requestedSessions,
						false,
						true,
						defaultOrgId
					) // (sessionsDetails, received = true or false, sent = true or false , orgId = "1")
				}

				if (isMentor && receivedSessions.length > 0) {
					result.isRequestedSessionMenteeNotified = await this.NotifySessionRequestedUsers(
						receivedSessions,
						true,
						false,
						defaultOrgId
					) // (sessionsDetails, received = true or false, sent = true or false , orgId = "1")
				}
			}

			// Step 6: Remove user and sessions
			let removedUserDetails = 0

			let mentorDetailsRemoved = 0
			let menteeDetailsRemoved = 0

			if (isMentor) {
				// Handle mentor-specific deletion tasks
				await this.handleMentorDeletion(userId, userInfo, result, tenantCode)

				// Remove mentor from DB
				mentorDetailsRemoved = await mentorQueries.removeMentorDetails(userId, tenantCode) // userId = "1"

				// Unenroll and notify attendees of sessions created by mentor
				const removedSessionsDetail = await sessionQueries.removeAndReturnMentorSessions(userId, tenantCode) // userId = "1"
				result.isAttendeesNotified = await this.unenrollAndNotifySessionAttendees(
					removedSessionsDetail,
					userInfo.organization_code || ''
				) //removedSessionsDetail , orgId : "1")
			}


			// send email to SM when mentee is deleted from the private sessions if it is upcoming
			await this.notifySessionManagerIfMenteeDeleted(userId, userInfo, result)

			// Always check and remove mentee extension (user can be both mentor and mentee)
			try {
				menteeDetailsRemoved = await menteeQueries.deleteMenteeExtension(userId, tenantCode) // userId = "1"
			} catch (error) {
				console.log('No mentee extension found or already removed:', error.message)
			}

			// User details are cleared if either mentor or mentee details were removed
			removedUserDetails = mentorDetailsRemoved + menteeDetailsRemoved
			result.areUserDetailsCleared = removedUserDetails > 0

			// Get private sessions where deleted mentee was the only attendee
			const privateSessions = await sessionQueries.getUpcomingSessionsOfMentee(
				userId,
				common.SESSION_TYPE.PRIVATE
			)

			// increment seats_remaining
			try {
				const upcomingPublicSessions = await sessionQueries.getUpcomingSessionsOfMentee(
					userId,
					common.SESSION_TYPE.PUBLIC
				)
				const allUpcomingSessions = [...privateSessions, ...upcomingPublicSessions]
				for (const session of allUpcomingSessions) {
					await sessionQueries.updateRecords(
						{ seats_remaining: literal('seats_remaining + 1') },
						{ where: { id: session.id } }
					)
				}
				result.isSeatsUpdate = true
			} catch (error) {
				console.error('Error handling while session seats_remaining updating:', error)
				result.isSeatsUpdate = false
			}

			// Step 7: Handle private session cancellations and notifications
			try {
				if (privateSessions.length > 0) {
					result.isPrivateSessionsCancelled = await this.notifyAndCancelPrivateSessions(
						privateSessions,
						userInfo.organization_code || '',
						tenantCode
					)
				} else {
					result.isPrivateSessionsCancelled = true
				}
			} catch (error) {
				console.error('Error handling private session cancellations:', error)
				result.isPrivateSessionsCancelled = false
			}

			// Step 8: Remove user from ALL sessions (attendees and enrollments) - not just upcoming
			try {
				const sessionCleanup = await sessionAttendeesQueries.removeUserFromAllSessions(userId, tenantCode)
				result.isUnenrolledFromSessions =
					sessionCleanup.attendeeResult >= 0 && sessionCleanup.enrollmentResult >= 0
			} catch (error) {
				console.error('Error removing user from all sessions:', error)
				result.isUnenrolledFromSessions = false
			}

			// Step 9: Final Response
			const allOperationsSuccessful =
				result.isUnenrolledFromSessions &&
				result.areUserDetailsCleared &&
				result.isMentorNotifiedAboutMenteeDeletion !== false &&
				result.isPrivateSessionsCancelled !== false &&
				result.isMenteeNotifiedAboutMentorDeletion !== false &&
				result.isSessionRequestsRejected !== false &&
				result.isSessionManagerNotified !== false &&
				result.isAssignedSessionsUpdated !== false

			if (allOperationsSuccessful) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'USER_REMOVED_SUCCESSFULLY',
					result,
				})
			}
			return responses.failureResponse({
				statusCode: httpStatusCode.bad_request,
				message: 'USER_NOT_REMOVED_SUCCESSFULLY',
				result,
			})
		} catch (error) {
			console.error('An error occurred in userDelete:', error)
			return error
		}
	}

	// Session Manager Deletion Flow Codes

	// static async assignNewSessionManager(decodedToken, oldSessionManagerId, newSessionManagerId, orgAdminUserId) {
	// 	if (!decodedToken.roles.some((role) => role.title === common.ADMIN_ROLE)) {
	// 		return responses.failureResponse({
	// 			message: 'UNAUTHORIZED_REQUEST',
	// 			statusCode: httpStatusCode.unauthorized,
	// 			responseCode: 'UNAUTHORIZED',
	// 		})
	// 	}

	// 	let result = {}

	// 	const getUserDetails = await menteeQueries.getUsersByUserIds([oldSessionManagerId])
	// 	if (getUserDetails.length <= 0) {
	// 		return responses.failureResponse({
	// 			statusCode: httpStatusCode.bad_request,
	// 			message: 'USER_NOT_FOUND',
	// 			result,
	// 		})
	// 	}

	// 	const userInfo = getUserDetails[0]
	// 	const isMentor = userInfo.isMentor === true
	// 	const isAlreadyUnderDeletion = userInfo.status === common.UNDER_DELETION_STATUS

	// 	// ✅ Step 1: Validate using org policy helper
	// 	const policyValidationResponse = await this.validateSessionReassignmentPolicies(
	// 		oldSessionManagerId,
	// 		newSessionManagerId,
	// 		orgAdminUserId
	// 	)
	// 	// If policy validation fails, return directly
	// 	if (policyValidationResponse.statusCode === httpStatusCode.bad_request) {
	// 		return policyValidationResponse
	// 	}

	// 	// If user is not under deletion
	// 	if (!isAlreadyUnderDeletion) {
	// 		return responses.failureResponse({
	// 			statusCode: httpStatusCode.bad_request,
	// 			message: 'USER_DELETION_NOT_INITIATED',
	// 			result,
	// 		})
	// 	}

	// 	// ✅ Step 2: Proceed with reassignment logic
	// 	let updateSessionsByNewSessionManager
	// 	let removedUserDetails

	// 	const isSessionManager = true // Based on logic context, assuming already validated

	// 	if (isSessionManager && isMentor) {
	// 		updateSessionsByNewSessionManager = await sessionQueries.replaceSessionManagerAndReturn(
	// 			oldSessionManagerId,
	// 			newSessionManagerId,
	// 			orgAdminUserId
	// 		)
	// 		removedUserDetails = await mentorQueries.removeMentorDetails(oldSessionManagerId)
	// 			const removedSessionsDetail = await sessionQueries.removeAndReturnMentorSessions(oldSessionManagerId)
	// 			result.isAttendeesNotified = await this.unenrollAndNotifySessionAttendees(
	// 				removedSessionsDetail,
	// 				userInfo.organization_id ? userInfo.organization_id : ''
	// 			)
	// 	} else if (isSessionManager) {
	// 		updateSessionsByNewSessionManager = await sessionQueries.replaceSessionManagerAndReturn(
	// 			oldSessionManagerId,
	// 			newSessionManagerId
	// 		)

	// 		removedUserDetails = await menteeQueries.removeMenteeDetails(oldSessionManagerId)
	// 	}

	// 	result.sessionsUpdated = updateSessionsByNewSessionManager
	// 	return responses.successResponse({
	// 		statusCode: httpStatusCode.ok,
	// 		message: 'SESSION_MANAGER_REASSIGNED_SUCCESSFULLY',
	// 		result,
	// 	})
	// }

	static async NotifySessionRequestedUsers(sessionsDetails, received = false, sent = false, orgCode = '') {
		try {
			const templateCode = received
				? process.env.MENTEE_SESSION_REQUEST_DELETION_EMAIL_CODE
				: process.env.MENTOR_SESSION_REQUEST_DELETION_EMAIL_CODE

			const sessionsWithRecipients = sessionsDetails.map((session) => ({
				...session,
				recipient_id: received ? session.requestor_id : session.requestee_id,
			}))

			return await NotificationHelper.sendSessionNotification({
				sessions: sessionsWithRecipients,
				templateCode,
				orgCode,
				recipientField: 'recipient_id',
				addionalData: { nameOfTheSession: '{sessionName}' },
				tenantCode,
			})
		} catch (error) {
			console.error('An error occurred in NotifySessionRequestedUsers:', error)
			return false
		}
	}

	static async unenrollAndNotifySessionAttendees(removedSessionsDetail, orgCode = '') {
		try {
			// Send notifications using generic helper
			const notificationResult = await NotificationHelper.sendSessionNotification({
				sessions: removedSessionsDetail,
				templateCode: process.env.MENTOR_SESSION_DELETION_EMAIL_CODE,
				orgCode,
				recipientField: 'attendees',
				addionalData: { nameOfTheSession: '{sessionName}' },
				tenantCode,
			})

			// Unenroll attendees from sessions
			const sessionIds = removedSessionsDetail.map((session) => session.id)
			const unenrollCount = await sessionAttendeesQueries.unEnrollAllAttendeesOfSessions(sessionIds)
			return notificationResult
		} catch (error) {
			console.error('An error occurred in notifySessionAttendees:', error)
			return false
		}
	}

	static async unenrollFromUpcomingSessions(userId, tenantCode) {
		try {
			const upcomingSessions = await sessionQueries.getAllUpcomingSessions(false, tenantCode)

			const upcomingSessionsId = upcomingSessions.map((session) => session.id)
			const usersUpcomingSessions = await sessionAttendeesQueries.usersUpcomingSessions(
				userId,
				upcomingSessionsId,
				tenantCode
			)
			if (usersUpcomingSessions.length === 0) {
				return true
			}
			await Promise.all(
				usersUpcomingSessions.map(async (session) => {
					await sessionQueries.updateEnrollmentCount(session.session_id, true, tenantCode)
				})
			)

			const unenrollFromUpcomingSessions = await sessionAttendeesQueries.unenrollFromUpcomingSessions(
				userId,
				upcomingSessionsId,
				tenantCode
			)
			return true
		} catch (error) {
			console.error('An error occurred in unenrollFromUpcomingSessions:', error)
			return error
		}
	}

	static async findAllRequestSessions(userId, tenantCode) {
		try {
			// Get session requests directly from database to avoid circular dependency
			const sessionRequestMappingQueries = require('@database/queries/requestSessionMapping')

			// Get requests where user is requestor (sent requests)
			const sentRequests = await requestSessionQueries.getAllRequests(
				userId,
				common.CONNECTIONS_STATUS.REQUESTED,
				tenantCode
			)
			const sentRequestsData = sentRequests.rows || []

			// Get requests where user is requestee (received requests)
			const sessionRequestMapping = await sessionRequestMappingQueries.getSessionsMapping(userId, tenantCode)
			const sessionRequestIds = sessionRequestMapping.map((s) => s.request_session_id)

			const receivedRequests = await requestSessionQueries.getSessionMappingDetails(
				sessionRequestIds,
				common.CONNECTIONS_STATUS.REQUESTED,
				tenantCode
			)
			const receivedRequestsData = receivedRequests || []

			// Combine and process all requests
			const allData = [
				...sentRequestsData.map((req) => ({ ...req, request_type: 'sent' })),
				...receivedRequestsData.map((req) => ({ ...req.dataValues, request_type: 'received' })),
			]

			if (allData.length === 0) {
				return {
					allSessionRequestIds: [],
					requestedSessions: [],
					receivedSessions: [],
				}
			}

			const allSessionRequestIds = []
			const requestedSessions = []
			const receivedSessions = []

			for (const sessionRequest of allData) {
				allSessionRequestIds.push(sessionRequest.id)

				if (sessionRequest.request_type === 'sent') {
					requestedSessions.push(sessionRequest) // full data
				} else if (sessionRequest.request_type === 'received') {
					receivedSessions.push(sessionRequest) // full data
				}
			}

			return {
				allSessionRequestIds, // array of IDs
				requestedSessions, // array of objects
				receivedSessions, // array of objects
			}
		} catch (error) {
			console.error('Error in findAllRequestSessions:', error)
			return {
				allSessionRequestIds: [],
				requestedSessions: [],
				receivedSessions: [],
			}
		}
	}

	static async triggerViewRebuild(decodedToken, tenantCode) {
		try {
			const result = await adminService.triggerViewBuild(tenantCode)
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'MATERIALIZED_VIEW_GENERATED_SUCCESSFULLY',
			})
		} catch (error) {
			console.error('An error occurred in userDelete:', error)
			return error
		}
	}
	static async triggerPeriodicViewRefresh(decodedToken, tenantCode) {
		try {
			const result = await adminService.triggerPeriodicViewRefresh(tenantCode)
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'MATERIALIZED_VIEW_REFRESH_INITIATED_SUCCESSFULLY',
			})
		} catch (error) {
			console.error('An error occurred in userDelete:', error)
			return error
		}
	}
	static async triggerPeriodicViewRefreshInternal(modelName, tenantCode) {
		try {
			const result = await adminService.refreshMaterializedView(modelName)
			console.log(result)
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'MATERIALIZED_VIEW_REFRESH_INITIATED_SUCCESSFULLY',
			})
		} catch (error) {
			console.error('An error occurred in userDelete:', error)
			return error
		}
	}

	static async notifyAndCancelPrivateSessions(privateSessions, orgCode, tenantCode) {
		const transaction = await sequelize.transaction()
		try {
			let allNotificationsSent = true

			for (const session of privateSessions) {
				// Check if this is a one-on-one session (only one attendee)
				const attendeeCount = await sessionAttendeesQueries.getCount({
					session_id: session.id,
					tenant_code: tenantCode,
				})

				if (attendeeCount === 1 && session.mentor_id == session.created_by) {
					// This is a one-on-one private session, cancel it and notify mentor
					const notificationSent = await this.notifyMentorAboutPrivateSessionCancellation(
						session.mentor_id,
						session,
						orgCode,
						tenantCode
					)

					if (!notificationSent) {
						allNotificationsSent = false
					}

					// Mark session as cancelled/deleted
					await sessionQueries.updateRecords(
						{ deleted_at: new Date() },
						{ where: { id: session.id, tenant_code: tenantCode } },
						transaction
					)
					await sessionOwnerships.updateRecords(
						{ deleted_at: new Date() },
						{ where: { id: session.id, user_id: session.mentor_id } },
						transaction
					)

					console.log(`Cancelled private session ${session.id} due to mentee deletion`)
				}
			}
			await transaction.commit()
			return allNotificationsSent
		} catch (error) {
			await transaction.rollback()
			console.error('Error notifying and cancelling private sessions:', error)
			return false
		}
	}

	// Session Manager Deletion Flow Codes

	// static async validateSessionReassignmentPolicies(oldSessionManagerId, newSessionManagerId, orgAdminUserId) {
	// 	try {
	// 		const userIds = Array.from(new Set([oldSessionManagerId, newSessionManagerId, orgAdminUserId])); // avoid duplicate fetch
	// 		const userDetailsResponse = await userRequests.getListOfUserDetails(userIds, true);
	// 		const users = userDetailsResponse?.result || [];
	// 		const getUserById = (id) => users.find(u => u.id === id);
	// 		const oldSMUser = getUserById(oldSessionManagerId);
	// 		const newSMUser = getUserById(newSessionManagerId);
	// 		const orgAdminUser = getUserById(orgAdminUserId);

	// 		if (!oldSMUser) {
	// 			return responses.failureResponse({
	// 				statusCode: httpStatusCode.bad_request,
	// 				message: `Old session manager (ID: ${oldSessionManagerId}) not found`,
	// 			});
	// 		}

	// 		const oldOrgId = oldSMUser.organization_id;

	// 		const getExtensionData = async (userId) => {
	// 			const user = getUserById(userId);
	// 			if (!user) return null;

	// 			const roles = (user.user_roles || []).map(r => r.title);
	// 			if (roles.includes(common.MENTOR_ROLE)) {
	// 				return mentorExtensionQueries.getMentorExtension(userId, ['organization_id']);
	// 			} else if (roles.includes(common.MENTEE_ROLE)) {
	// 				return menteeQueries.getMenteeExtension(userId, ['organization_id']);
	// 			}
	// 			return null;
	// 		};

	// 		const uniqueUserIdsForExtension = Array.from(new Set([
	// 			oldSessionManagerId,
	// 			newSessionManagerId,
	// 			orgAdminUserId,
	// 		]));

	// 		const extensionResults = await Promise.all(uniqueUserIdsForExtension.map(id => getExtensionData(id)));
	// 		const extensionMap = {};
	// 		uniqueUserIdsForExtension.forEach((id, idx) => extensionMap[id] = extensionResults[idx]);

	// 		const newSMPolicy = extensionMap[newSessionManagerId];
	// 		const orgAdminPolicy = extensionMap[orgAdminUserId];

	// 		if (!newSMPolicy || !newSMPolicy.organization_id) {
	// 			return responses.failureResponse({
	// 				statusCode: httpStatusCode.bad_request,
	// 				message: `New session manager (ID: ${newSessionManagerId}) has no organization_id in extension data`,
	// 			});
	// 		}

	// 		if (!orgAdminPolicy || !orgAdminPolicy.organization_id) {
	// 			return responses.failureResponse({
	// 				statusCode: httpStatusCode.bad_request,
	// 				message: `Org admin (ID: ${orgAdminUserId}) has no organization_id in extension data`,
	// 			});
	// 		}

	// 		const getUserRoleTitles = (user) => (user?.user_roles || []).map(r => r.title);

	// 		if (!getUserRoleTitles(newSMUser).includes(common.SESSION_MANAGER_ROLE)) {
	// 			return responses.failureResponse({
	// 				statusCode: httpStatusCode.bad_request,
	// 				message: `New session manager (ID: ${newSessionManagerId}) does not have required role: ${common.SESSION_MANAGER_ROLE}`,
	// 			});
	// 		}

	// 		if (!getUserRoleTitles(orgAdminUser).includes(common.ORG_ADMIN_ROLE)) {
	// 			return responses.failureResponse({
	// 				statusCode: httpStatusCode.bad_request,
	// 				message: 'Org admin must have ORG_ADMIN_ROLE in the same organization as old session manager.',
	// 			});
	// 		}

	// 		const isUserAllowedToAccessOrg = async (userId, targetOrgId) => {
	// 			const mentorExt = await mentorQueries.getMentorExtension(userId, ['organization_id']);
	// 			const menteeExt = await menteeQueries.getMenteeExtension(userId, ['organization_id']);

	// 			const policiesToCheck = [];
	// 			if (mentorExt?.organization_id) policiesToCheck.push(mentorExt.organization_id);
	// 			if (menteeExt?.organization_id) policiesToCheck.push(menteeExt.organization_id);

	// 			for (const orgId of policiesToCheck) {
	// 				const orgPolicy = await organisationExtensionQueries.findOne(
	// 					{ organization_id: orgId },
	// 					{ attributes: ['external_mentee_visibility_policy'] }
	// 				);

	// 				const visibilityPolicy = orgPolicy?.external_mentee_visibility_policy;
	// 				if (!visibilityPolicy) continue;

	// 				if (visibilityPolicy === common.CURRENT) {
	// 					if (orgId === targetOrgId) return true;
	// 				} else if (visibilityPolicy === common.ASSOCIATED) {

	// 					const mentor = await mentorQueries.getMentorExtension(
	// 						 userId,
	// 						{ attributes: ['visible_to_organizations', 'mentee_visibility'] }
	// 					)

	// 					if (
	// 						mentor &&
	// 						mentor.mentee_visibility !== 'CURRENT' &&
	// 						Array.isArray(mentor.visible_to_organizations) &&
	// 						mentor.visible_to_organizations.includes(targetOrgId)
	// 					) {
	// 						return true;
	// 					}
	// 				} else if (visibilityPolicy === common.ALL) {
	// 					return true;
	// 				}
	// 			}
	// 			return false;
	// 		};

	// 		const isNewSMAllowed = await isUserAllowedToAccessOrg(newSessionManagerId, oldOrgId);
	// 		if (!isNewSMAllowed) {
	// 			return responses.failureResponse({
	// 				statusCode: httpStatusCode.bad_request,
	// 				message: `New session manager (ID: ${newSessionManagerId}) does not have policy access to old session manager's organization`,
	// 			});
	// 		}

	// 		// Only check orgAdmin if it's a different user than newSessionManager
	// 		if (newSessionManagerId !== orgAdminUserId) {
	// 			const isOrgAdminAllowed = await isUserAllowedToAccessOrg(orgAdminUserId, oldOrgId);
	// 			if (!isOrgAdminAllowed) {
	// 				return responses.failureResponse({
	// 					statusCode: httpStatusCode.bad_request,
	// 					message: `Org admin (ID: ${orgAdminUserId}) does not have policy access to old session manager's organization`,
	// 				});
	// 			}
	// 		}

	// 		return true

	// 	} catch (error) {
	// 		return responses.failureResponse({
	// 			statusCode: httpStatusCode.bad_request,
	// 			message: `Session policy validation failed: ${error.message}`,
	// 			responseCode: 'CLIENT_ERROR',
	// 		});
	// 	}
	// }

	static async getConnectedMentors(menteeUserId, tenantCode) {
		try {
			// Use raw query to get connected mentors
			const Connection = require('@database/models/index').Connection
			const { QueryTypes } = require('sequelize')
			const sequelize = require('@database/models/index').sequelize

			const query = `
				SELECT DISTINCT user_id 
				FROM ${Connection.tableName} 
				WHERE friend_id = :menteeUserId 
				AND status = :acceptedStatus
				AND tenant_code = :tenantCode
			`

			const connections = await sequelize.query(query, {
				type: QueryTypes.SELECT,
				replacements: {
					menteeUserId,
					acceptedStatus: common.CONNECTIONS_STATUS.ACCEPTED,
					tenantCode,
				},
			})

			const mentorIds = connections.map((conn) => conn.user_id)

			if (mentorIds.length === 0) {
				return []
			}

			// Get mentor details for notification
			const mentors = (await mentorExtensionQueries.getMentorsByUserIds)
				? await mentorExtensionQueries.getMentorsByUserIds(
						mentorIds,
						{
							attributes: ['user_id', 'name', 'email'],
						},
						false,
						tenantCode
				  )
				: await userExtensionQueries.getUsersByUserIds(
						mentorIds,
						{
							attributes: ['user_id', 'name', 'email'],
						},
						false,
						tenantCode
				  )

			return mentors || []
		} catch (error) {
			console.error('Error getting connected mentors:', error)
			return []
		}
	}

	static async notifyMentorsAboutMenteeDeletion(mentors, menteeName, orgCode, tenantCode) {
		return await NotificationHelper.sendGenericNotification({
			recipients: mentors,
			templateCode: process.env.MENTEE_DELETION_NOTIFICATION_EMAIL_TEMPLATE,
			orgCode,
			templateData: { menteeName },
			subjectData: { menteeName },
			tenantCode,
		})
	}

	static async getPrivateSessionsWithDeletedMentee(menteeUserId, tenantCode) {
		try {
			const Session = require('@database/models/index').Session
			const SessionAttendee = require('@database/models/index').SessionAttendee
			const { QueryTypes } = require('sequelize')
			const sequelize = require('@database/models/index').sequelize

			// Get private sessions where the deleted mentee was enrolled and session is in future
			const query = `
				SELECT DISTINCT s.id, s.title, s.mentor_id, s.start_date, s.end_date, s.type
				FROM ${Session.tableName} s
				INNER JOIN ${SessionAttendee.tableName} sa ON s.id = sa.session_id
				WHERE sa.mentee_id = :menteeUserId
				AND s.type = :privateType
				AND s.start_date > :currentTime
				AND s.deleted_at IS NULL
				AND s.tenant_code = :tenantCode
				AND sa.tenant_code = :tenantCode
			`

			const privateSessions = await sequelize.query(query, {
				type: QueryTypes.SELECT,
				replacements: {
					menteeUserId,
					privateType: common.SESSION_TYPE.PRIVATE,
					currentTime: Math.floor(Date.now() / 1000),
					tenantCode,
				},
			})

			return privateSessions || []
		} catch (error) {
			console.error('Error getting private sessions with deleted mentee:', error)
			return []
		}
	}

	static async notifyMentorAboutPrivateSessionCancellation(mentorId, sessionDetails, orgCode, tenantCode) {
		try {
			// Get mentor details
			const mentorDetails = await mentorExtensionQueries.getMentorExtension(
				mentorId,
				['name', 'email'],
				true,
				tenantCode
			)
			if (!mentorDetails) {
				console.log('Mentor details not found for notification')
				return false
			}

			const sessionDateTime = moment.unix(sessionDetails.start_date)

			return await NotificationHelper.sendGenericNotification({
				recipients: [mentorDetails],
				templateCode: process.env.PRIVATE_SESSION_CANCELLED_EMAIL_TEMPLATE,
				orgCode,
				templateData: {
					sessionName: sessionDetails.title,
					sessionDate: sessionDateTime.format('DD-MM-YYYY'),
					sessionTime: sessionDateTime.format('hh:mm A'),
				},
				subjectData: { sessionName: sessionDetails.title },
				tenantCode,
			})
		} catch (error) {
			console.error('Error notifying mentor about private session cancellation:', error)
			return false
		}
	}

	static async handleMentorDeletion(mentorUserId, mentorInfo, result, tenantCode) {
		try {
			const orgCode = userInfo.organization_code || ''

			// 1. Notify session managers about sessions with deleted mentor
			const upcomingSessions = await sessionQueries.getUpcomingSessionsOfMentee(
				userId,
				common.SESSION_TYPE.PRIVATE
			)

			if (upcomingSessions.length > 0) {
				result.isSessionManagerNotified = await this.notifySessionManagersAboutMenteeDeletion(
					upcomingSessions,
					userInfo.name,
					orgCode,
					tenantCode
				)
			} else {
				result.isSessionManagerNotified = true
			}
			return result
		} catch (error) {
			console.error('Error in notifySessionManagerIfMenteeDeleted:', error)
			result.isSessionManagerNotified = false
		}
	}

	static async handleMentorDeletion(mentorUserId, mentorInfo, result, tenantCode) {
		try {
			const orgCode = mentorInfo.organization_code || ''

			// 1. Notify connected mentees about mentor deletion
			const menteeIds = await connectionQueries.getConnectedUsers(
				mentorUserId,
				'friend_id',
				'user_id',
				tenantCode
			)
			const connectedMentees = await userExtensionQueries.getUsersByUserIds(menteeIds, {
				attributes: ['user_id', 'name', 'email'],
			})

			if (connectedMentees.length > 0) {
				result.isMenteeNotifiedAboutMentorDeletion = await this.notifyMenteesAboutMentorDeletion(
					connectedMentees,
					mentorInfo.name || 'Mentor',
					orgCode,
					tenantCode
				)
			} else {
				result.isMenteeNotifiedAboutMentorDeletion = true
			}

			// 2. Handle session requests - auto-reject pending requests

			const pendingSessionRequests = await requestSessionQueries.getPendingSessionRequests(
				mentorUserId,
				tenantCode
			)

			if (pendingSessionRequests.length > 0) {
				result.isSessionRequestsRejected = await this.rejectSessionRequestsDueToMentorDeletion(
					pendingSessionRequests,
					orgCode,
					tenantCode
				)
			} else {
				result.isSessionRequestsRejected = true
			}

			// 3. Notify session managers about sessions with deleted mentor

			const upcomingSessions = await sessionQueries.getUpcomingSessionsForMentor(mentorUserId, tenantCode)

			if (upcomingSessions.length > 0) {
				result.isSessionManagerNotifiedForMentorDelete = await this.notifySessionManagersAboutMentorDeletion(
					upcomingSessions,
					mentorInfo.name || 'Mentor',
					orgCode,
					tenantCode
				)

				// update upcoming sessions of mentor to set as deleted if he created only
				const sessionIds = [...new Set(upcomingSessions.map((s) => s.id))]
				await sessionQueries.updateRecords(
					{ deleted_at: new Date() },
					{ where: { id: sessionIds, created_by: mentorUserId } }
				)
			} else {
				result.isSessionManagerNotifiedForMentorDelete = true
			}

			// 4. Delete sessions where mentor was assigned (not created by mentor)

			result.isAssignedSessionsUpdated = await this.updateSessionsWithAssignedMentor(mentorUserId, orgCode)
		} catch (error) {
			console.error('Error in handleMentorDeletion:', error)
			result.isMenteeNotifiedAboutMentorDeletion = false
			result.isSessionRequestsRejected = false
			result.isSessionManagerNotifiedForMentorDelete = false
			result.isAssignedSessionsUpdated = false
		}
	}

	static async getConnectedMentees(mentorUserId, tenantCode) {
		try {
			const Connection = require('@database/models/index').Connection
			const { QueryTypes } = require('sequelize')
			const sequelize = require('@database/models/index').sequelize

			const query = `
				SELECT DISTINCT friend_id as user_id
				FROM ${Connection.tableName} 
				WHERE user_id = :mentorUserId 
				AND status = :acceptedStatus
				AND tenant_code = :tenantCode
			`

			const connections = await sequelize.query(query, {
				type: QueryTypes.SELECT,
				replacements: {
					mentorUserId,
					acceptedStatus: common.CONNECTIONS_STATUS.ACCEPTED,
					tenantCode,
				},
			})

			const menteeIds = connections.map((conn) => conn.user_id)

			if (menteeIds.length === 0) {
				return []
			}

			const mentees = await userExtensionQueries.getUsersByUserIds(
				menteeIds,
				{
					attributes: ['user_id', 'name', 'email'],
				},
				false,
				tenantCode
			)

			return mentees || []
		} catch (error) {
			console.error('Error getting connected mentees:', error)
			return []
		}
	}
	static async updateSessionsWithAssignedMentor(mentorUserId, orgCode, tenantCode) {
		// Notify attendees about session deletion

		const sessionsToUpdate = await sessionQueries.getSessionsAssignedToMentor(mentorUserId, tenantCode)

		if (sessionsToUpdate.length == 0) {
			return true
		}

		await this.notifyAttendeesAboutMentorDeletion(sessionsToUpdate, orgCode)

		// Delete the sessions
		const sessionIds = [...new Set(sessionsToUpdate.map((s) => s.id))]
		await sessionQueries.updateRecords({ mentor_name: common.USER_NOT_FOUND }, { where: { id: sessionIds } })

		console.log(`Update ${sessionIds.length} sessions with assigned mentor`)
		return true
	}

	static async notifyMenteesAboutMentorDeletion(mentees, mentorName, orgCode, tenantCode) {
		return await NotificationHelper.sendGenericNotification({
			recipients: mentees,
			templateCode: process.env.MENTOR_DELETION_NOTIFICATION_EMAIL_TEMPLATE,
			orgCode,
			templateData: { mentorName },
			subjectData: { mentorName },
			tenantCode,
		})
	}

	static async getPendingSessionRequestsForMentor(mentorUserId, tenantCode) {
		try {
			const { QueryTypes } = require('sequelize')
			const sequelize = require('@database/models/index').sequelize
			const RequestSession = require('@database/models/index').RequestSession

			const query = `
				SELECT rs.*, rm.requestee_id
				FROM ${RequestSession.tableName} rs
				INNER JOIN request_session_mapping rm ON rs.id = rm.request_session_id
				WHERE rm.requestee_id = :mentorUserId 
				AND rs.status = :requestedStatus
				AND rs.deleted_at IS NULL
				AND rs.tenant_code = :tenantCode
				AND rm.tenant_code = :tenantCode
			`

			const pendingRequests = await sequelize.query(query, {
				type: QueryTypes.SELECT,
				replacements: {
					mentorUserId,
					requestedStatus: common.CONNECTIONS_STATUS.REQUESTED,
					tenantCode,
				},
			})

			return pendingRequests || []
		} catch (error) {
			console.error('Error getting pending session requests for mentor:', error)
			return []
		}
	}

	static async rejectSessionRequestsDueToMentorDeletion(sessionRequests, orgCode, tenantCode) {
		try {
			for (const request of sessionRequests) {
				// Mark request as rejected
				await requestSessionQueries.rejectRequest(
					request.requestee_id,
					request.id,
					'Mentor no longer available',
					tenantCode
				)

				// Get mentee details for notification
				const menteeDetails = await userExtensionQueries.getUsersByUserIds(
					[request.requestor_id],
					{
						attributes: ['name', 'email'],
					},
					false,
					tenantCode
				)

				if (menteeDetails.length > 0) {
					// Send notification to requestor (mentee)
					await NotificationHelper.sendGenericNotification({
						recipients: menteeDetails,
						templateCode: process.env.SESSION_REQUEST_REJECTED_MENTOR_DELETION_EMAIL_TEMPLATE,
						orgCode,
						templateData: { sessionName: request.title },
						subjectData: { sessionName: request.title },
						tenantCode,
					})
				}
			}

			console.log(`Rejected ${sessionRequests.length} session requests due to mentor deletion`)
			return true
		} catch (error) {
			console.error('Error rejecting session requests due to mentor deletion:', error)
			return false
		}
	}

	static async notifySessionManagersAboutMentorDeletion(sessions, mentorName, orgCode, tenantCode) {
		try {
			const templateCode = process.env.SESSION_MANAGER_MENTOR_DELETION_EMAIL_TEMPLATE
			if (!templateCode) {
				console.log('No email template configured for session manager mentor deletion notification')
				return true
			}

			// Group sessions by session manager
			const sessionsByManager = {}
			sessions.forEach((session) => {
				if (!sessionsByManager[session.created_by]) {
					sessionsByManager[session.created_by] = []
				}
				sessionsByManager[session.created_by].push(session)
			})

			const notificationPromises = Object.keys(sessionsByManager).map(async (managerId) => {
				const managerSessions = sessionsByManager[managerId]

				// Get session manager details
				const managerDetails = await userExtensionQueries.getUsersByUserIds(
					[managerId],
					{
						attributes: ['name', 'email'],
					},
					false,
					tenantCode
				)

				if (managerDetails.length > 0) {
					const sessionList = managerSessions
						.map((session) => {
							const sessionDateTime = moment.unix(session.start_date)
							return `${session.title} – ${sessionDateTime.format('DD-MM-YYYY, hh:mm A')}`
						})
						.join('\n')

					await NotificationHelper.sendGenericNotification({
						recipients: managerDetails,
						templateCode,
						orgCode,
						templateData: { mentorName, sessionList },
						subjectData: { mentorName },
						tenantCode,
					})
				}
			})

			await Promise.all(notificationPromises)
			console.log(`Notified session managers about mentor deletion for ${sessions.length} sessions`)
			return true
		} catch (error) {
			console.error('Error notifying session managers about mentor deletion:', error)
			return false
		}
	}

	static async notifySessionManagersAboutMenteeDeletion(sessions, menteeName, orgCode, tenantCode) {
		try {
			const templateCode = process.env.SESSION_MANAGER_MENTEE_DELETION_EMAIL_TEMPLATE
			if (!templateCode) {
				console.log('No email template configured for session manager mentee deletion notification')
				return true
			}

			// Group sessions by session manager
			const sessionsByManager = {}
			sessions.forEach((session) => {
				if (!sessionsByManager[session.created_by]) {
					sessionsByManager[session.created_by] = []
				}
				sessionsByManager[session.created_by].push(session)
			})

			const notificationPromises = Object.keys(sessionsByManager).map(async (managerId) => {
				const managerSessions = sessionsByManager[managerId]

				// Get session manager details

				const managerDetails = await userExtensionQueries.getUsersByUserIds([managerId], {
					attributes: ['name', 'email'],
					tenantCode,
				})

				if (managerDetails.length > 0) {
					const sessionList = managerSessions
						.map((session) => {
							const sessionDateTime = moment.unix(session.start_date)
							return `${session.title} – ${sessionDateTime.format('DD-MM-YYYY, hh:mm A')}`
						})
						.join('\n')

					await NotificationHelper.sendGenericNotification({
						recipients: managerDetails,
						templateCode,
						orgCode,
						templateData: { menteeName: menteeName, sessionList: sessionList },
						subjectData: { menteeName: menteeName },
						tenantCode,
					})
				}
			})

			await Promise.all(notificationPromises)
			console.log(`Notified session managers about mentor deletion for ${sessions.length} sessions`)
			return true
		} catch (error) {
			console.error('Error notifying session managers about mentee deletion:', error)
			return false
		}
	}

	static async notifyAttendeesAboutSessionDeletion(sessions, orgCode, tenantCode) {
		try {
			const templateCode = process.env.SESSION_DELETED_MENTOR_DELETION_EMAIL_TEMPLATE
			if (!templateCode) {
				console.log('No email template configured for session deletion due to mentor deletion')
				return
			}

			// Group sessions by attendee
			const sessionsByAttendee = {}
			sessions.forEach((session) => {
				if (!sessionsByAttendee[session.mentee_id]) {
					sessionsByAttendee[session.mentee_id] = []
				}
				sessionsByAttendee[session.mentee_id].push(session)
			})

			const notificationPromises = Object.keys(sessionsByAttendee).map(async (attendeeId) => {
				const attendeeSessions = sessionsByAttendee[attendeeId]

				const attendeeDetails = await userExtensionQueries.getUsersByUserIds(
					[attendeeId],
					{
						attributes: ['name', 'email'],
					},
					false,
					tenantCode

				)

				if (attendeeDetails.length > 0) {
					for (const session of attendeeSessions) {
						await NotificationHelper.sendGenericNotification({
							recipients: attendeeDetails,
							templateCode,
							orgCode,
							templateData: { sessionName: session.title },
							subjectData: { sessionName: session.title },
							tenantCode,
						})
					}
				}
			})

			await Promise.all(notificationPromises)
			console.log(`Notified attendees about session deletions due to mentor deletion`)
			return true
		} catch (error) {
			console.error('Error notifying attendees about session deletion:', error)
			return false
		}
	}
}
